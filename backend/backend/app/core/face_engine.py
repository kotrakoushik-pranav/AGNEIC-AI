"""
face_engine.py — Real facial recognition pipeline using OpenCV YuNet + SFace.

Pipeline:
  1. Frame → YuNet face detection → bounding boxes + landmarks
  2. Each face crop → SFace embedding (128-dim float32 vector)
  3. Embedding → cosine similarity against registered database
  4. Decision: similarity >= threshold → Recognized; else → Unknown

Models used (OpenCV model zoo, downloaded at startup):
  - face_detection_yunet_2023mar.onnx  (~232 KB)
  - face_recognition_sface_2021dec.onnx (~37 MB)

Both models are loaded ONCE when the engine starts.
"""

import base64
import json
import logging
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

MODELS_DIR = Path(__file__).parent.parent.parent / "models"

YUNET_MODEL = str(MODELS_DIR / "face_detection_yunet_2023mar.onnx")
SFACE_MODEL = str(MODELS_DIR / "face_recognition_sface_2021dec.onnx")

# Cosine similarity threshold: faces with similarity >= this are "recognized"
# Range 0-1; typical good value 0.363 for SFace (from OpenCV docs)
RECOGNITION_THRESHOLD = float(os.getenv("FACE_RECOGNITION_THRESHOLD", "0.363"))

# Detection confidence threshold for YuNet
DETECTION_CONFIDENCE = float(os.getenv("FACE_DETECTION_CONFIDENCE", "0.85"))

# ─── Data classes ────────────────────────────────────────────────────────────

@dataclass
class DetectedFace:
    """One face found in a frame."""
    bbox: dict          # {x, y, w, h}
    landmarks: Optional[np.ndarray]    # 5-point landmarks (for alignment)
    detection_conf: float
    embedding: Optional[np.ndarray] = None   # 128-dim float32
    face_crop_b64: Optional[str] = None      # base64 JPEG crop


@dataclass
class RecognitionResult:
    """Recognition result for one detected face."""
    detected_face: DetectedFace
    person_id: Optional[int]
    person_name: str
    similarity: Optional[float]
    # RECOGNIZED | UNKNOWN | VERIFYING
    status: str
    track_id: Optional[int] = None


# ─── Engine ──────────────────────────────────────────────────────────────────

class FaceEngine:
    """
    Singleton face engine.  Loads models once, provides thread-safe methods
    for detection, embedding extraction, and similarity matching.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._detector: Optional[cv2.FaceDetectorYN] = None
        self._recognizer: Optional[cv2.FaceRecognizerSF] = None
        self._model_status = "not_loaded"
        self._load_error: Optional[str] = None

    # ── Model lifecycle ──────────────────────────────────────────────────────

    def load_models(self) -> bool:
        """Load YuNet and SFace models.  Returns True on success."""
        with self._lock:
            if self._model_status == "ready":
                return True
            self._model_status = "loading"

        try:
            if not os.path.exists(YUNET_MODEL):
                msg = f"YuNet model not found: {YUNET_MODEL}"
                logger.error(msg)
                self._model_status = "unavailable"
                self._load_error = msg
                return False

            if not os.path.exists(SFACE_MODEL):
                msg = f"SFace model not found: {SFACE_MODEL}"
                logger.error(msg)
                self._model_status = "unavailable"
                self._load_error = msg
                return False

            # YuNet: initialise with a default input size; will be resized per-frame
            detector = cv2.FaceDetectorYN.create(
                YUNET_MODEL, "", (640, 480),
                score_threshold=DETECTION_CONFIDENCE,
                nms_threshold=0.3,
                top_k=100,
            )

            recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")

            with self._lock:
                self._detector = detector
                self._recognizer = recognizer
                self._model_status = "ready"

            logger.info("Face engine: YuNet + SFace models loaded. Threshold=%.3f", RECOGNITION_THRESHOLD)
            return True

        except Exception as exc:
            msg = f"Failed to load face models: {exc}"
            logger.error(msg)
            with self._lock:
                self._model_status = "error"
                self._load_error = msg
            return False

    @property
    def is_ready(self) -> bool:
        return self._model_status == "ready"

    @property
    def status(self) -> dict:
        return {
            "model_status": self._model_status,
            "error": self._load_error,
            "threshold": RECOGNITION_THRESHOLD,
            "detection_confidence": DETECTION_CONFIDENCE,
            "yunet_model": os.path.basename(YUNET_MODEL),
            "sface_model": os.path.basename(SFACE_MODEL),
        }

    # ── Detection ────────────────────────────────────────────────────────────

    def detect_faces(self, frame: np.ndarray) -> List[DetectedFace]:
        """
        Detect all faces in a BGR frame using YuNet.
        Returns list of DetectedFace (without embeddings yet).
        """
        if not self.is_ready:
            return []

        h, w = frame.shape[:2]
        if h == 0 or w == 0:
            return []

        with self._lock:
            self._detector.setInputSize((w, h))
            _, faces = self._detector.detect(frame)

        if faces is None or len(faces) == 0:
            return []

        results: List[DetectedFace] = []
        for face_data in faces:
            # YuNet output: [x, y, w, h, rx, ry, ex, ey, nx, ny, mx, my, ml, mr, conf]
            x, y, w_f, h_f = int(face_data[0]), int(face_data[1]), int(face_data[2]), int(face_data[3])
            conf = float(face_data[-1])

            # Clamp to frame bounds
            x = max(0, x)
            y = max(0, y)
            w_f = min(w_f, frame.shape[1] - x)
            h_f = min(h_f, frame.shape[0] - y)

            if w_f <= 0 or h_f <= 0:
                continue

            landmarks = face_data[4:14].reshape(5, 2)  # 5 landmark points

            # Generate face crop thumbnail
            crop = frame[y:y+h_f, x:x+w_f]
            face_crop_b64 = _encode_crop(crop)

            results.append(DetectedFace(
                bbox={"x": x, "y": y, "w": w_f, "h": h_f},
                landmarks=landmarks,
                detection_conf=conf,
                face_crop_b64=face_crop_b64,
            ))

        return results

    # ── Embedding ────────────────────────────────────────────────────────────

    def extract_embedding(self, frame: np.ndarray, face: DetectedFace) -> Optional[np.ndarray]:
        """
        Extract a 128-dim SFace embedding from the detected face in the frame.
        Uses YuNet bbox + landmarks for alignment before embedding.
        """
        if not self.is_ready:
            return None

        try:
            # SFace needs the YuNet face array (15 values: bbox + landmarks + conf)
            x, y, w, h = face.bbox["x"], face.bbox["y"], face.bbox["w"], face.bbox["h"]
            lm = face.landmarks.flatten() if face.landmarks is not None else np.zeros(10, dtype=np.float32)
            face_array = np.array([x, y, w, h,
                                   *lm,
                                   face.detection_conf], dtype=np.float32)

            with self._lock:
                aligned = self._recognizer.alignCrop(frame, face_array)
                embedding = self._recognizer.feature(aligned)

            # Normalize to unit vector for cosine similarity
            norm = np.linalg.norm(embedding)
            if norm == 0:
                return None
            return embedding / norm

        except Exception as exc:
            logger.error("Embedding extraction error: %s", exc)
            return None

    # ── Matching ────────────────────────────────────────────────────────────

    def match_embedding(
        self,
        query_embedding: np.ndarray,
        registered: List[Tuple[int, str, np.ndarray]],
    ) -> Tuple[Optional[int], Optional[str], Optional[float]]:
        """
        Compare query embedding against all registered embeddings.

        registered: list of (person_id, person_name, embedding_ndarray)

        Returns: (person_id, person_name, best_similarity)
                 person_id is None if no match above threshold.
        """
        if not registered:
            return None, None, None

        best_id: Optional[int] = None
        best_name: Optional[str] = None
        best_sim: float = -1.0

        for person_id, person_name, db_embedding in registered:
            # Cosine similarity on unit vectors = dot product
            sim = float(np.dot(query_embedding.flatten(), db_embedding.flatten()))
            if sim > best_sim:
                best_sim = sim
                best_id = person_id
                best_name = person_name

        if best_sim >= RECOGNITION_THRESHOLD:
            return best_id, best_name, best_sim
        else:
            return None, None, best_sim

    # ── Full pipeline ────────────────────────────────────────────────────────

    def process_frame(
        self,
        frame: np.ndarray,
        registered: List[Tuple[int, str, np.ndarray]],
    ) -> List[RecognitionResult]:
        """
        Run full detection + recognition pipeline on one frame.

        registered: list of (person_id, person_name, embedding_ndarray)
        Returns list of RecognitionResult (one per detected face).
        """
        faces = self.detect_faces(frame)
        results: List[RecognitionResult] = []

        for face in faces:
            embedding = self.extract_embedding(frame, face)
            if embedding is None:
                results.append(RecognitionResult(
                    detected_face=face,
                    person_id=None,
                    person_name="Unknown",
                    similarity=None,
                    status="UNKNOWN",
                ))
                continue

            face.embedding = embedding
            pid, pname, sim = self.match_embedding(embedding, registered)

            if pid is not None:
                status = "RECOGNIZED"
            else:
                status = "UNKNOWN"
                pname = "Unknown"

            results.append(RecognitionResult(
                detected_face=face,
                person_id=pid,
                person_name=pname,
                similarity=sim,
                status=status,
            ))

        return results

    # ── Annotate frame ───────────────────────────────────────────────────────

    def annotate_frame(
        self,
        frame: np.ndarray,
        results: List[RecognitionResult],
    ) -> str:
        """Draw bounding boxes + labels on frame. Returns base64 JPEG string."""
        vis = frame.copy()

        for r in results:
            bb = r.detected_face.bbox
            x, y, w, h = bb["x"], bb["y"], bb["w"], bb["h"]

            if r.status == "RECOGNIZED":
                color = (0, 220, 100)   # green
                label = f"{r.person_name}"
                if r.similarity is not None:
                    label += f" {r.similarity:.2f}"
            else:
                color = (0, 80, 240)    # red-ish
                label = "Unknown"
                if r.similarity is not None:
                    label += f" {r.similarity:.2f}"

            cv2.rectangle(vis, (x, y), (x + w, y + h), color, 2)
            cv2.putText(
                vis, label,
                (x, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2, cv2.LINE_AA,
            )

        ok, buf = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if not ok:
            return ""
        return base64.b64encode(buf.tobytes()).decode()


# ─── Singleton ───────────────────────────────────────────────────────────────

face_engine = FaceEngine()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _encode_crop(crop: np.ndarray) -> Optional[str]:
    """Encode a face crop as base64 JPEG."""
    if crop is None or crop.size == 0:
        return None
    try:
        # Resize to standard thumbnail size
        thumb = cv2.resize(crop, (80, 80), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ok:
            return None
        return base64.b64encode(buf.tobytes()).decode()
    except Exception:
        return None


def decode_b64_frame(b64_data: str) -> Optional[np.ndarray]:
    """Decode a base64 JPEG/PNG data-URI or raw base64 into a BGR numpy frame."""
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.error("Frame decode error: %s", exc)
        return None


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    """Serialize a numpy embedding to bytes for DB storage."""
    return embedding.astype(np.float32).tobytes()


def bytes_to_embedding(data: bytes) -> np.ndarray:
    """Deserialize bytes from DB back into numpy embedding."""
    arr = np.frombuffer(data, dtype=np.float32)
    return arr
