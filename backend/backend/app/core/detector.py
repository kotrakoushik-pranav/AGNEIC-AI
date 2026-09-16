"""
detector.py — CPU-only AI detection engine using OpenCV.

Modules:
  - Face detection: YuNet DNN (via face_engine) — no Haar cascade needed
  - Fire detection: HSV color heuristic
  - Smoke detection: Grayscale variance + brightness heuristic
  - Other modules: stub returning MODEL_UNAVAILABLE
"""

import base64
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

FACE_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.55"))
FIRE_CONFIDENCE_THRESHOLD = float(os.getenv("FIRE_CONFIDENCE_THRESHOLD", "0.65"))
SMOKE_CONFIDENCE_THRESHOLD = float(os.getenv("SMOKE_CONFIDENCE_THRESHOLD", "0.60"))

MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

# ─── Data types ──────────────────────────────────────────────────────────────

@dataclass
class BoundingBox:
    x: int
    y: int
    w: int
    h: int

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


@dataclass
class DetectionResult:
    detection_type: str
    confidence: float
    bounding_boxes: List[BoundingBox] = field(default_factory=list)
    frame_b64: Optional[str] = None
    model_status: str = "ok"


# ─── Frame annotator ─────────────────────────────────────────────────────────

def _annotate_and_encode(
    frame: np.ndarray,
    boxes: List[BoundingBox],
    color: Tuple[int, int, int],
    label: str,
) -> str:
    vis = frame.copy()
    for box in boxes:
        cv2.rectangle(vis, (box.x, box.y), (box.x + box.w, box.y + box.h), color, 2)
        cv2.putText(
            vis, label, (box.x, box.y - 6),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA,
        )
    ok, buf = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 70])
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode()


# ─── Face Detection (via YuNet in face_engine) ───────────────────────────────

def detect_faces(frame: np.ndarray) -> DetectionResult:
    """Use the YuNet-based face_engine for face detection."""
    try:
        from app.core.face_engine import face_engine
        if not face_engine.is_ready:
            return DetectionResult("face", 0.0, model_status="unavailable")

        detected = face_engine.detect_faces(frame)
        if not detected:
            return DetectionResult("face", 0.0)

        boxes = [
            BoundingBox(
                f.bbox["x"], f.bbox["y"], f.bbox["w"], f.bbox["h"]
            )
            for f in detected
        ]

        # Confidence: use max detection confidence from YuNet
        conf = max(f.detection_conf for f in detected)
        conf = max(conf, FACE_CONFIDENCE_THRESHOLD)
        conf = min(conf, 0.97)

        frame_b64 = _annotate_and_encode(frame, boxes, (0, 200, 255), "Face")
        return DetectionResult("face", round(conf, 3), boxes, frame_b64)

    except Exception as exc:
        logger.error("detect_faces error: %s", exc)
        return DetectionResult("face", 0.0, model_status="error")


# ─── Fire Detection (HSV color heuristic) ───────────────────────────────────

def detect_fire(frame: np.ndarray) -> DetectionResult:
    """
    Detects fire-colored pixels (red/orange/yellow) in HSV space.
    No model required — works on any CPU.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Fire hue ranges: red wraps around 0, plus orange/yellow
    lower1 = np.array([0,  120, 120])
    upper1 = np.array([20, 255, 255])
    lower2 = np.array([160, 120, 120])
    upper2 = np.array([180, 255, 255])

    mask1 = cv2.inRange(hsv, lower1, upper1)
    mask2 = cv2.inRange(hsv, lower2, upper2)
    mask = cv2.bitwise_or(mask1, mask2)

    total_pixels = frame.shape[0] * frame.shape[1]
    fire_pixels = int(np.sum(mask > 0))
    ratio = fire_pixels / total_pixels

    if ratio < 0.01:   # less than 1% fire pixels
        return DetectionResult("fire", 0.0)

    # Confidence based on pixel ratio (capped at 0.95)
    conf = min(0.50 + ratio * 15, 0.95)
    if conf < FIRE_CONFIDENCE_THRESHOLD:
        return DetectionResult("fire", 0.0)

    # Find contours for bounding boxes
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 400:
            x, y, w, h = cv2.boundingRect(cnt)
            boxes.append(BoundingBox(x, y, w, h))

    frame_b64 = _annotate_and_encode(frame, boxes, (0, 60, 255), "Fire")
    return DetectionResult("fire", round(conf, 3), boxes, frame_b64)


# ─── Smoke Detection (brightness/variance heuristic) ────────────────────────

def detect_smoke(frame: np.ndarray) -> DetectionResult:
    """
    Detects smoke via gray pixel clustering + low-saturation high-brightness regions.
    Heuristic — not a trained model.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    # Low saturation, mid-to-high value = gray/white foggy regions
    lower = np.array([0,   0,  140])
    upper = np.array([180, 60, 255])
    mask = cv2.inRange(hsv, lower, upper)

    total_pixels = frame.shape[0] * frame.shape[1]
    smoke_pixels = int(np.sum(mask > 0))
    ratio = smoke_pixels / total_pixels

    if ratio < 0.15:  # need >15% gray coverage
        return DetectionResult("smoke", 0.0)

    conf = min(0.50 + (ratio - 0.15) * 3.0, 0.90)
    if conf < SMOKE_CONFIDENCE_THRESHOLD:
        return DetectionResult("smoke", 0.0)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for cnt in contours:
        if cv2.contourArea(cnt) > 2000:
            x, y, w, h = cv2.boundingRect(cnt)
            boxes.append(BoundingBox(x, y, w, h))

    frame_b64 = _annotate_and_encode(frame, boxes, (128, 128, 200), "Smoke")
    return DetectionResult("smoke", round(conf, 3), boxes, frame_b64)


# ─── Stub modules ────────────────────────────────────────────────────────────

def detect_fall(frame: np.ndarray) -> DetectionResult:
    return DetectionResult("fall", 0.0, model_status="unavailable")


def detect_accident(frame: np.ndarray) -> DetectionResult:
    return DetectionResult("accident", 0.0, model_status="unavailable")


def detect_suspicious(frame: np.ndarray) -> DetectionResult:
    return DetectionResult("suspicious", 0.0, model_status="unavailable")


# ─── Main run-all function ───────────────────────────────────────────────────

ENABLED_DETECTORS = {
    "face":       detect_faces,
    "fire":       detect_fire,
    "smoke":      detect_smoke,
    "fall":       detect_fall,
    "accident":   detect_accident,
    "suspicious": detect_suspicious,
}


def run_all_detectors(frame: np.ndarray, enabled: List[str] = None) -> List[DetectionResult]:
    """Run all enabled detectors on a single frame. Returns list of positive detections."""
    if enabled is None:
        enabled = ["face", "fire", "smoke"]

    results = []
    for name in enabled:
        fn = ENABLED_DETECTORS.get(name)
        if fn is None:
            continue
        try:
            result = fn(frame)
            if result.confidence > 0.0:
                results.append(result)
        except Exception as exc:
            logger.error("Detector '%s' error: %s", name, exc)
            results.append(DetectionResult(name, 0.0, model_status="error"))
    return results


def get_model_status() -> dict:
    """Return the availability status of each detection module."""
    from app.core.face_engine import face_engine
    return {
        "face":       "ok" if face_engine.is_ready else "unavailable",
        "fire":       "ok",
        "smoke":      "ok",
        "fall":       "unavailable",
        "accident":   "unavailable",
        "suspicious": "unavailable",
    }
