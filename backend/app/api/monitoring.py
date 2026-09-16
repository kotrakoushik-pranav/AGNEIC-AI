"""
monitoring.py — Start/stop monitoring and frame processing endpoints.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db, SessionLocal
from app.services import camera_service
from app.core.monitor import process_frame
from app.core.websocket_manager import manager as ws_manager
from app.core.detector import get_model_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


class StartMonitoringRequest(BaseModel):
    camera_id: int
    enabled_detectors: list = ["face", "fire", "smoke"]


class StopMonitoringRequest(BaseModel):
    camera_id: int


class FrameRequest(BaseModel):
    camera_id: Optional[int] = None
    frame: str               # base64 encoded JPEG/PNG
    enabled_detectors: list = ["face", "fire", "smoke"]


@router.post("/start")
async def start_monitoring(data: StartMonitoringRequest, db: Session = Depends(get_db)):
    camera = camera_service.get_by_id(db, data.camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status not in ("ONLINE", "CONNECTED"):
        raise HTTPException(
            status_code=400,
            detail=f"Camera is {camera.status}. Connect it first."
        )
    camera_service.update_status(db, data.camera_id, camera.status, is_monitoring=True)
    await ws_manager.broadcast_monitoring_status(data.camera_id, True)
    return {"message": "Monitoring started", "camera_id": data.camera_id}


@router.post("/stop")
async def stop_monitoring(data: StopMonitoringRequest, db: Session = Depends(get_db)):
    camera = camera_service.get_by_id(db, data.camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera_service.update_status(db, data.camera_id, camera.status, is_monitoring=False)
    await ws_manager.broadcast_monitoring_status(data.camera_id, False)
    return {"message": "Monitoring stopped", "camera_id": data.camera_id}


@router.post("/frame")
async def submit_frame(data: FrameRequest, db: Session = Depends(get_db)):
    """
    Receive a base64-encoded frame from the browser and run AI detection.
    Called by the frontend ~every 500ms when monitoring is active.

    STRICT VALIDATION: Camera must be ONLINE and have is_monitoring=True.
    Detections are rejected if the camera is not actively connected.
    """
    location = "Unknown"
    if data.camera_id is not None:
        camera = camera_service.get_by_id(db, data.camera_id)
        if camera:
            # Must be both ONLINE and monitoring — reject stale/offline cameras
            if camera.status not in ("ONLINE", "CONNECTED"):
                return {"skipped": True, "reason": f"camera_not_online (status={camera.status})"}
            if not camera.is_monitoring:
                return {"skipped": True, "reason": "monitoring_not_active"}
            location = camera.location
        else:
            return {"skipped": True, "reason": "camera_not_found"}
    else:
        # camera_id=None is not allowed — we require a valid camera for all detections
        return {"skipped": True, "reason": "camera_id_required"}

    result = await process_frame(
        camera_id=data.camera_id,
        camera_location=location,
        frame_b64=data.frame,
        enabled_detectors=data.enabled_detectors,
        db_session_factory=SessionLocal,
    )
    return result


@router.get("/model-status")
def model_status():
    """Returns availability of each AI detection module."""
    return get_model_status()
