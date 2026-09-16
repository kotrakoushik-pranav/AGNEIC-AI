"""
recognition.py — Facial recognition API endpoints.

Endpoints:
  GET  /api/recognition/status          → engine + session status
  POST /api/recognition/start           → start recognition on a camera
  POST /api/recognition/stop            → stop recognition
  POST /api/recognition/frame           → submit a video frame for processing
  GET  /api/recognition/events          → recognition history

  GET  /api/persons                     → list all registered persons
  POST /api/persons                     → register a new person
  GET  /api/persons/{id}                → get person detail
  DELETE /api/persons/{id}              → delete person + all face data
  POST /api/persons/{id}/faces          → add face image to a person
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db, SessionLocal
from app.core.face_engine import face_engine
from app.services import recognition_service
from app.services.recognition_service import embedding_cache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["recognition"])


# ─── Pydantic models ─────────────────────────────────────────────────────────

class StartRecognitionRequest(BaseModel):
    camera_id: Optional[int] = None
    camera_name: str = "Webcam"


class StopRecognitionRequest(BaseModel):
    camera_id: Optional[int] = None


class FrameRequest(BaseModel):
    camera_id: Optional[int] = None
    camera_name: str = "Webcam"
    frame: str          # base64-encoded JPEG/PNG (data-URI or raw)


class PersonCreate(BaseModel):
    name: str
    reference_id: Optional[str] = None


class AddFaceRequest(BaseModel):
    image: str          # base64-encoded image (data-URI or raw)


# ─── Recognition control ─────────────────────────────────────────────────────

@router.get("/recognition/status")
def recognition_status(db: Session = Depends(get_db)):
    """Return current engine status, session status, and live detection counts."""
    engine_status = face_engine.status
    all_sessions = {}
    for cam_id, session in recognition_service._sessions.items():
        all_sessions[str(cam_id)] = {
            "active": session.active,
            "faces_detected": session.faces_detected,
            "recognized": session.recognized_count,
            "unknown": session.unknown_count,
            "current_faces": session.current_faces,
        }

    # Count registered persons
    from app.models.person import Person, FaceEmbedding
    person_count = db.query(Person).filter(Person.active == True).count()
    embedding_count = db.query(FaceEmbedding).count()

    return {
        "engine": engine_status,
        "model_ready": face_engine.is_ready,
        "registered_persons": person_count,
        "registered_embeddings": embedding_count,
        "sessions": all_sessions,
    }


@router.post("/recognition/start")
async def start_recognition(data: StartRecognitionRequest):
    """Start a facial recognition session for a camera."""
    if not face_engine.is_ready:
        # Try loading the models
        loaded = face_engine.load_models()
        if not loaded:
            raise HTTPException(
                status_code=503,
                detail=f"Face recognition model unavailable: {face_engine.status.get('error', 'unknown')}",
            )

    session = recognition_service.start_session(data.camera_id)
    # Force embedding reload
    embedding_cache.mark_dirty()

    from app.core.websocket_manager import manager as ws_manager
    await ws_manager.broadcast("recognition_started", {
        "camera_id": data.camera_id,
        "camera_name": data.camera_name,
    })

    return {
        "message": "Recognition started",
        "camera_id": data.camera_id,
        "model_status": face_engine.status["model_status"],
    }


@router.post("/recognition/stop")
async def stop_recognition(data: StopRecognitionRequest):
    """Stop a facial recognition session."""
    recognition_service.stop_session(data.camera_id)

    from app.core.websocket_manager import manager as ws_manager
    await ws_manager.broadcast("recognition_stopped", {"camera_id": data.camera_id})

    return {"message": "Recognition stopped", "camera_id": data.camera_id}


@router.post("/recognition/frame")
async def submit_recognition_frame(data: FrameRequest):
    """
    Receive a base64-encoded video frame and run facial recognition.
    Called by the frontend at regular intervals when recognition is active.
    Returns per-face results for real-time UI updates.
    """
    result = await recognition_service.process_recognition_frame(
        camera_id=data.camera_id,
        camera_name=data.camera_name,
        frame_b64=data.frame,
        db_session_factory=SessionLocal,
    )
    return result


@router.get("/recognition/events")
def get_recognition_events(
    limit: int = 100,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Return recognition history (most recent first)."""
    return recognition_service.get_recognition_events(db, limit=limit, skip=skip)


@router.get("/recognition/events/count-today")
def count_recognition_events_today(db: Session = Depends(get_db)):
    """Count recognition events created today (UTC)."""
    from app.models.person import RecognitionEvent
    from datetime import datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(RecognitionEvent).filter(RecognitionEvent.detected_at >= today_start).count()
    return {"count": count}


# ─── Person management ───────────────────────────────────────────────────────

@router.get("/persons")
def list_persons(db: Session = Depends(get_db)):
    """List all registered persons with face counts."""
    return recognition_service.get_all_persons(db)


@router.post("/persons", status_code=201)
def create_person(data: PersonCreate, db: Session = Depends(get_db)):
    """Register a new person (no face images yet)."""
    person = recognition_service.register_person(db, name=data.name, reference_id=data.reference_id)
    return {
        "id": person.id,
        "name": person.name,
        "reference_id": person.reference_id,
        "active": person.active,
        "face_count": 0,
        "created_at": person.created_at.isoformat() if person.created_at else None,
    }


@router.get("/persons/{person_id}")
def get_person(person_id: int, db: Session = Depends(get_db)):
    """Get a single person with face count."""
    from app.models.person import Person, FaceEmbedding
    person = db.query(Person).filter(Person.id == person_id, Person.active == True).first()
    if person is None:
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found")
    face_count = db.query(FaceEmbedding).filter(FaceEmbedding.person_id == person_id).count()
    return {
        "id": person.id,
        "name": person.name,
        "reference_id": person.reference_id,
        "active": person.active,
        "face_count": face_count,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
    }


@router.delete("/persons/{person_id}", status_code=204)
def delete_person(person_id: int, db: Session = Depends(get_db)):
    """Delete a person and all their face embeddings."""
    deleted = recognition_service.delete_person(db, person_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Person {person_id} not found")


@router.post("/persons/{person_id}/faces")
def add_face(person_id: int, data: AddFaceRequest, db: Session = Depends(get_db)):
    """
    Add a face image to a registered person.
    The image must contain exactly one face.
    Embedding is extracted server-side and stored in the database.
    """
    result = recognition_service.add_face_to_person(
        db=db,
        person_id=person_id,
        frame_b64=data.image,
    )
    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])
    return result
