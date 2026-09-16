"""
recognition_service.py — Stateful facial recognition session manager.

Handles:
- Loading registered face embeddings from DB into memory cache
- Temporal confirmation (N consecutive matches before committing)
- Cooldown between duplicate unknown-person events
- Persisting RecognitionEvent rows
- Broadcasting real-time events via WebSocket
"""

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.core.face_engine import (
    face_engine,
    decode_b64_frame,
    embedding_to_bytes,
    bytes_to_embedding,
    RecognitionResult,
)
from app.core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

# Consecutive frames a face must match before creating a recognition event
CONFIRMATION_FRAMES = int(os.getenv("FACE_CONFIRMATION_FRAMES", "3")) if False else 3
try:
    import os as _os
    CONFIRMATION_FRAMES = int(_os.getenv("FACE_CONFIRMATION_FRAMES", "3"))
except Exception:
    CONFIRMATION_FRAMES = 3

# Minimum seconds between duplicate unknown-person events (per camera)
UNKNOWN_COOLDOWN_SECONDS = float(__import__("os").getenv("FACE_UNKNOWN_COOLDOWN", "15"))

# Minimum seconds between duplicate recognized-person events (per camera+person)
RECOGNIZED_COOLDOWN_SECONDS = float(__import__("os").getenv("FACE_RECOGNIZED_COOLDOWN", "30"))

# Max frames in the frame-sampling rate limiter
PROCESS_EVERY_N_FRAMES = int(__import__("os").getenv("FACE_PROCESS_EVERY_N", "3"))


# ─── In-memory embedding cache ───────────────────────────────────────────────

class EmbeddingCache:
    """Thread-safe in-memory cache of registered face embeddings."""

    def __init__(self):
        self._entries: List[Tuple[int, str, np.ndarray]] = []
        self._dirty = True

    def mark_dirty(self):
        """Call whenever the DB persons/embeddings change."""
        self._dirty = True

    def load(self, db_session_factory) -> int:
        """Reload all active person embeddings from DB."""
        from app.models.person import Person, FaceEmbedding
        db = db_session_factory()
        try:
            rows = (
                db.query(FaceEmbedding, Person.name)
                .join(Person, FaceEmbedding.person_id == Person.id)
                .filter(Person.active == True)
                .all()
            )
            entries = []
            for emb_row, person_name in rows:
                vec = bytes_to_embedding(emb_row.embedding_bytes)
                entries.append((emb_row.person_id, person_name, vec))
            self._entries = entries
            self._dirty = False
            logger.info("EmbeddingCache loaded %d embeddings", len(entries))
            return len(entries)
        except Exception as exc:
            logger.error("EmbeddingCache.load error: %s", exc)
            return 0
        finally:
            db.close()

    def get_all(self) -> List[Tuple[int, str, np.ndarray]]:
        return self._entries

    @property
    def is_dirty(self) -> bool:
        return self._dirty

    @property
    def count(self) -> int:
        return len(self._entries)


embedding_cache = EmbeddingCache()


# ─── Temporal tracker ────────────────────────────────────────────────────────

class FaceTracker:
    """
    Tracks consecutive recognition results per face position to avoid
    single-frame false positives.

    Uses a simple spatial proximity key (grid cell) to loosely associate
    faces across frames without full feature tracking.
    """

    def __init__(self, confirmation_frames: int = 3):
        self._confirmation = confirmation_frames
        # key: grid cell string → deque of (person_id or None, person_name, similarity)
        self._history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=self._confirmation))

    def _cell_key(self, bbox: dict) -> str:
        """Map bbox to coarse grid cell key."""
        cx = bbox["x"] + bbox["w"] // 2
        cy = bbox["y"] + bbox["h"] // 2
        # 80px grid cells
        return f"{cx // 80}_{cy // 80}"

    def update(self, result: RecognitionResult) -> Optional[RecognitionResult]:
        """
        Add a result to the tracker.
        Returns the result if confirmed (N consecutive consistent matches),
        returns None if still verifying.
        """
        key = self._cell_key(result.detected_face.bbox)
        history = self._history[key]
        history.append((result.person_id, result.person_name, result.similarity))

        if len(history) < self._confirmation:
            return None  # Not enough frames yet

        # Check consistency: all frames agree on person_id
        pids = [h[0] for h in history]
        if len(set(pids)) == 1:
            return result  # Consistent — confirmed

        return None  # Still inconsistent — verifying

    def clear_stale(self, max_age_frames: int = 10):
        """Remove stale trackers (call periodically)."""
        # Simple: clear all — grid cells will repopulate naturally
        if len(self._history) > 50:
            self._history.clear()


# ─── Cooldown tracker ────────────────────────────────────────────────────────

class CooldownTracker:
    """Prevents duplicate events within a configurable time window."""

    def __init__(self):
        # key: (camera_id, person_id_or_"unknown") → last_event_time
        self._last_event: Dict[str, float] = {}

    def should_create_event(
        self,
        camera_id: Optional[int],
        person_id: Optional[int],
        is_unknown: bool,
    ) -> bool:
        """Returns True if enough time has passed since the last event."""
        if is_unknown:
            key = f"{camera_id}_unknown"
            cooldown = UNKNOWN_COOLDOWN_SECONDS
        else:
            key = f"{camera_id}_{person_id}"
            cooldown = RECOGNIZED_COOLDOWN_SECONDS

        now = time.monotonic()
        last = self._last_event.get(key, 0.0)
        if now - last >= cooldown:
            self._last_event[key] = now
            return True
        return False


# ─── Session state ───────────────────────────────────────────────────────────

class RecognitionSession:
    """Per-camera recognition session state."""

    def __init__(self, camera_id: Optional[int]):
        self.camera_id = camera_id
        self.active = False
        self.frame_counter = 0
        self.tracker = FaceTracker(CONFIRMATION_FRAMES)
        self.cooldown = CooldownTracker()
        # current live state for the /recognition/status endpoint
        self.current_faces: List[dict] = []
        self.faces_detected = 0
        self.recognized_count = 0
        self.unknown_count = 0


# Global sessions: camera_id → RecognitionSession
_sessions: Dict[Optional[int], RecognitionSession] = {}


def get_or_create_session(camera_id: Optional[int]) -> RecognitionSession:
    if camera_id not in _sessions:
        _sessions[camera_id] = RecognitionSession(camera_id)
    return _sessions[camera_id]


def get_session(camera_id: Optional[int]) -> Optional[RecognitionSession]:
    return _sessions.get(camera_id)


def start_session(camera_id: Optional[int]) -> RecognitionSession:
    session = get_or_create_session(camera_id)
    session.active = True
    session.frame_counter = 0
    logger.info("Recognition session started for camera_id=%s", camera_id)
    return session


def stop_session(camera_id: Optional[int]):
    session = _sessions.get(camera_id)
    if session:
        session.active = False
        session.current_faces = []
        session.faces_detected = 0
        session.recognized_count = 0
        session.unknown_count = 0
    logger.info("Recognition session stopped for camera_id=%s", camera_id)


# ─── Person / embedding CRUD ─────────────────────────────────────────────────

def register_person(db, name: str, reference_id: Optional[str] = None):
    """Create a Person row. Returns the new Person."""
    from app.models.person import Person
    person = Person(name=name, reference_id=reference_id, active=True)
    db.add(person)
    db.commit()
    db.refresh(person)
    embedding_cache.mark_dirty()
    return person


def add_face_to_person(
    db,
    person_id: int,
    frame_b64: str,
) -> dict:
    """
    Extract embedding from a submitted face image and store it.
    Returns {"success": bool, "error": str|None, "embedding_id": int|None}
    """
    from app.models.person import Person, FaceEmbedding

    person = db.query(Person).filter(Person.id == person_id, Person.active == True).first()
    if person is None:
        return {"success": False, "error": "Person not found", "embedding_id": None}

    if not face_engine.is_ready:
        return {"success": False, "error": "Face model not loaded", "embedding_id": None}

    frame = decode_b64_frame(frame_b64)
    if frame is None:
        return {"success": False, "error": "Invalid image data", "embedding_id": None}

    faces = face_engine.detect_faces(frame)

    if len(faces) == 0:
        return {"success": False, "error": "No face detected in the image", "embedding_id": None}
    if len(faces) > 1:
        return {"success": False, "error": f"Multiple faces detected ({len(faces)}). Please submit a photo with exactly one face.", "embedding_id": None}

    face = faces[0]
    embedding = face_engine.extract_embedding(frame, face)
    if embedding is None:
        return {"success": False, "error": "Failed to extract face embedding", "embedding_id": None}

    emb_row = FaceEmbedding(
        person_id=person_id,
        embedding_bytes=embedding_to_bytes(embedding),
        thumbnail_b64=face.face_crop_b64,
    )
    db.add(emb_row)
    db.commit()
    db.refresh(emb_row)
    embedding_cache.mark_dirty()

    return {"success": True, "error": None, "embedding_id": emb_row.id}


def get_all_persons(db):
    from app.models.person import Person, FaceEmbedding
    persons = db.query(Person).filter(Person.active == True).all()
    result = []
    for p in persons:
        face_count = db.query(FaceEmbedding).filter(FaceEmbedding.person_id == p.id).count()
        result.append({
            "id": p.id,
            "name": p.name,
            "reference_id": p.reference_id,
            "face_count": face_count,
            "active": p.active,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    return result


def delete_person(db, person_id: int) -> bool:
    from app.models.person import Person, FaceEmbedding
    person = db.query(Person).filter(Person.id == person_id).first()
    if person is None:
        return False
    # Delete embeddings first
    db.query(FaceEmbedding).filter(FaceEmbedding.person_id == person_id).delete()
    db.delete(person)
    db.commit()
    embedding_cache.mark_dirty()
    return True


def get_recognition_events(db, limit: int = 100, skip: int = 0):
    from app.models.person import RecognitionEvent
    rows = (
        db.query(RecognitionEvent)
        .order_by(RecognitionEvent.detected_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for r in rows:
        result.append({
            "id": r.id,
            "person_id": r.person_id,
            "person_name": r.person_name,
            "camera_id": r.camera_id,
            "camera_name": r.camera_name,
            "similarity": r.similarity,
            "result_status": r.result_status,
            "bounding_box": r.bounding_box,
            "face_crop_b64": r.face_crop_b64,
            "detected_at": r.detected_at.isoformat() if r.detected_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result


# ─── Frame processing ────────────────────────────────────────────────────────

async def process_recognition_frame(
    camera_id: Optional[int],
    camera_name: str,
    frame_b64: str,
    db_session_factory,
) -> dict:
    """
    Process one video frame through the full recognition pipeline.
    Called from the API endpoint. Returns a summary dict for the frontend.
    """
    session = get_session(camera_id)
    if session is None or not session.active:
        return {"active": False, "faces": [], "faces_detected": 0, "recognized": 0, "unknown": 0}

    # Frame sampling: process every N-th frame to reduce CPU load
    session.frame_counter += 1
    if session.frame_counter % PROCESS_EVERY_N_FRAMES != 0:
        return {
            "active": True,
            "faces": session.current_faces,
            "faces_detected": session.faces_detected,
            "recognized": session.recognized_count,
            "unknown": session.unknown_count,
        }

    if not face_engine.is_ready:
        return {"active": False, "error": "model_not_loaded", "faces": [], "faces_detected": 0, "recognized": 0, "unknown": 0}

    frame = decode_b64_frame(frame_b64)
    if frame is None:
        return {"active": True, "error": "invalid_frame", "faces": [], "faces_detected": 0, "recognized": 0, "unknown": 0}

    # Reload embedding cache if stale
    if embedding_cache.is_dirty:
        embedding_cache.load(db_session_factory)

    registered = embedding_cache.get_all()

    # Run pipeline
    results = face_engine.process_frame(frame, registered)

    # Build current live state
    current_faces = []
    recognized_count = 0
    unknown_count = 0

    for r in results:
        face_info = {
            "bbox": r.detected_face.bbox,
            "person_id": r.person_id,
            "person_name": r.person_name,
            "similarity": round(r.similarity, 4) if r.similarity is not None else None,
            "status": r.status,
            "face_crop_b64": r.detected_face.face_crop_b64,
        }
        current_faces.append(face_info)

        if r.status == "RECOGNIZED":
            recognized_count += 1
        else:
            unknown_count += 1

        # Temporal confirmation before creating events
        confirmed = session.tracker.update(r)
        if confirmed is not None:
            is_unknown = confirmed.person_id is None
            if session.cooldown.should_create_event(camera_id, confirmed.person_id, is_unknown):
                await _persist_recognition_event(
                    camera_id=camera_id,
                    camera_name=camera_name,
                    result=confirmed,
                    db_session_factory=db_session_factory,
                )

    session.current_faces = current_faces
    session.faces_detected = len(results)
    session.recognized_count = recognized_count
    session.unknown_count = unknown_count

    # Clean up stale trackers periodically
    if session.frame_counter % 60 == 0:
        session.tracker.clear_stale()

    return {
        "active": True,
        "faces": current_faces,
        "faces_detected": len(results),
        "recognized": recognized_count,
        "unknown": unknown_count,
    }


async def _persist_recognition_event(
    camera_id: Optional[int],
    camera_name: str,
    result: RecognitionResult,
    db_session_factory,
):
    """Persist a confirmed recognition event to DB and broadcast via WebSocket."""
    from app.models.person import RecognitionEvent

    now = datetime.now(timezone.utc)
    db = db_session_factory()
    try:
        event = RecognitionEvent(
            person_id=result.person_id,
            person_name=result.person_name,
            camera_id=camera_id,
            camera_name=camera_name,
            similarity=result.similarity,
            result_status=result.status,
            bounding_box=json.dumps(result.detected_face.bbox),
            face_crop_b64=result.detected_face.face_crop_b64,
            detected_at=now,
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        event_data = {
            "id": event.id,
            "person_id": event.person_id,
            "person_name": event.person_name,
            "camera_id": event.camera_id,
            "camera_name": event.camera_name,
            "similarity": event.similarity,
            "result_status": event.result_status,
            "detected_at": now.isoformat(),
        }
        await ws_manager.broadcast("recognition_event", event_data)
        logger.info(
            "Recognition event: %s (%s) camera=%s sim=%.3f",
            event.person_name, event.result_status,
            camera_id,
            event.similarity or 0.0,
        )
    except Exception as exc:
        db.rollback()
        logger.error("Failed to persist recognition event: %s", exc)
    finally:
        db.close()
