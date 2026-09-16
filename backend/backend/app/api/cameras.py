from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.camera_adapters import camera_manager
from app.core.websocket_manager import manager as ws_manager
from app.database.session import SessionLocal, get_db
from app.schemas.camera import CameraCreate, CameraResponse, CameraStatusUpdate
from app.services import camera_service

router = APIRouter(prefix="/cameras", tags=["cameras"])


# ─── Request models ───────────────────────────────────────────────────────────

class ConnectCameraRequest(BaseModel):
    adapter_type: str = "webrtc"   # rtsp|usb|webrtc|mobile|drone|etc.
    stream_url: Optional[str] = None
    device_index: Optional[int] = 0
    enabled_detectors: list = ["face", "fire", "smoke"]


class TestConnectionRequest(BaseModel):
    adapter_type: str
    stream_url: Optional[str] = None
    device_index: Optional[int] = 0


class PushFrameRequest(BaseModel):
    frame: str          # base64 JPEG/PNG (data-URI or raw)


# ─── Camera CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    return camera_service.get_all(db)


@router.get("/health/all")
def all_camera_health():
    """Real-time health metrics for all active camera workers."""
    return camera_manager.get_all_health()


@router.post("", response_model=CameraResponse, status_code=201)
def create_camera(data: CameraCreate, db: Session = Depends(get_db)):
    return camera_service.create(db, data)


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")
    return cam


@router.delete("/{camera_id}", status_code=204)
async def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")
    if camera_manager.is_running(camera_id):
        await camera_manager.stop_camera(camera_id)
    camera_service.delete(db, camera_id)


@router.patch("/{camera_id}/status", response_model=CameraResponse)
async def update_camera_status(
    camera_id: int,
    data: CameraStatusUpdate,
    db: Session = Depends(get_db),
):
    cam = camera_service.update_status(db, camera_id, data.status, data.is_monitoring)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")
    await ws_manager.broadcast_camera_status(camera_id, cam.status, cam.is_monitoring)
    return cam


@router.get("/{camera_id}/status", response_model=CameraResponse)
def get_camera_status(camera_id: int, db: Session = Depends(get_db)):
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")
    return cam


# ─── Camera health ────────────────────────────────────────────────────────────

@router.get("/{camera_id}/health")
def get_camera_health(camera_id: int):
    """Real-time health metrics for one camera worker."""
    health = camera_manager.get_health(camera_id)
    if health is None:
        return {
            "camera_id": camera_id,
            "status": "not_running",
            "message": "No active worker for this camera",
        }
    return {
        "camera_id": camera_id,
        "status": health.status,
        "error_reason": health.error_reason,
        "fps": round(health.fps, 1),
        "resolution": health.resolution,
        "last_frame_at": health.last_frame_at,
        "dropped_frames": health.dropped_frames,
        "reconnect_count": health.reconnect_count,
        "ai_processing": health.ai_processing,
        "people_detected": health.people_detected,
        "faces_recognized": health.faces_recognized,
        "frame_count": health.frame_count,
        "worker_id": health.worker_id,
    }


# ─── Camera events ────────────────────────────────────────────────────────────

@router.get("/{camera_id}/events")
def get_camera_events(camera_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Recent AI detections for a specific camera."""
    from app.models.detection import Detection

    rows = (
        db.query(Detection)
        .filter(Detection.camera_id == camera_id)
        .order_by(Detection.detected_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "detection_type": r.detection_type,
            "confidence": r.confidence,
            "detected_at": r.detected_at.isoformat() if r.detected_at else None,
        }
        for r in rows
    ]


# ─── Connect / Disconnect / Reconnect ────────────────────────────────────────

@router.post("/{camera_id}/connect")
async def connect_camera(
    camera_id: int,
    data: ConnectCameraRequest,
    db: Session = Depends(get_db),
):
    """Start a camera worker. For WebRTC/Mobile, also begin pushing frames from browser."""
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")

    config: dict = {}
    if data.stream_url:
        config["stream_url"] = data.stream_url
    if data.device_index is not None:
        config["device_index"] = data.device_index

    success, message = await camera_manager.start_camera(
        camera_id=camera_id,
        adapter_type=data.adapter_type,
        config=config,
        db_session_factory=SessionLocal,
        ws_manager=ws_manager,
        enabled_detectors=data.enabled_detectors,
    )
    if not success:
        raise HTTPException(400, message)

    return {"message": message, "camera_id": camera_id, "adapter_type": data.adapter_type}


@router.post("/{camera_id}/disconnect")
async def disconnect_camera(camera_id: int, db: Session = Depends(get_db)):
    """Stop a camera worker."""
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")

    if camera_manager.is_running(camera_id):
        await camera_manager.stop_camera(camera_id)

    camera_service.update_status(db, camera_id, "OFFLINE", is_monitoring=False)
    await ws_manager.broadcast_camera_status(camera_id, "OFFLINE", False)
    return {"message": f"Camera {camera_id} disconnected", "camera_id": camera_id}


@router.post("/{camera_id}/reconnect")
async def reconnect_camera(
    camera_id: int,
    data: ConnectCameraRequest,
    db: Session = Depends(get_db),
):
    """Stop and restart a camera worker."""
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")

    if camera_manager.is_running(camera_id):
        await camera_manager.stop_camera(camera_id)

    config: dict = {}
    if data.stream_url:
        config["stream_url"] = data.stream_url
    if data.device_index is not None:
        config["device_index"] = data.device_index

    success, message = await camera_manager.start_camera(
        camera_id=camera_id,
        adapter_type=data.adapter_type,
        config=config,
        db_session_factory=SessionLocal,
        ws_manager=ws_manager,
        enabled_detectors=data.enabled_detectors,
    )
    if not success:
        raise HTTPException(400, message)

    return {"message": f"Reconnected: {message}", "camera_id": camera_id}


# ─── Test connection ──────────────────────────────────────────────────────────

@router.post("/{camera_id}/test")
async def test_camera_connection(
    camera_id: int,
    data: TestConnectionRequest,
    db: Session = Depends(get_db),
):
    """Test a connection without starting a persistent worker."""
    import asyncio
    import concurrent.futures

    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")

    config: dict = {}
    if data.stream_url:
        config["stream_url"] = data.stream_url
    if data.device_index is not None:
        config["device_index"] = data.device_index

    def _run_test():
        return camera_manager.test_connection(data.adapter_type, config)

    # Run in executor with a timeout to avoid blocking the server on bad RTSP URLs
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            success, message = await asyncio.wait_for(
                loop.run_in_executor(pool, _run_test),
                timeout=15.0,
            )
    except asyncio.TimeoutError:
        return {"success": False, "message": "Connection test timed out after 15s", "camera_id": camera_id}
    except Exception as exc:
        return {"success": False, "message": f"Test error: {exc}", "camera_id": camera_id}

    return {"success": success, "message": message, "camera_id": camera_id}


# ─── Snapshot (latest frame as JPEG) ─────────────────────────────────────────

@router.get("/{camera_id}/snapshot")
def get_camera_snapshot(camera_id: int):
    """
    Returns the latest JPEG frame from the active camera worker.
    Used by the dashboard to display a live preview at ~5fps via polling.
    Returns 404 when no frame is available yet.
    """
    frame_bytes = camera_manager.get_latest_frame(camera_id)
    if frame_bytes is None:
        raise HTTPException(404, "No frame available for this camera")
    return Response(
        content=frame_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
        },
    )


# ─── Push frame (WebRTC / Mobile) ────────────────────────────────────────────

@router.post("/{camera_id}/frame")
def push_camera_frame(
    camera_id: int,
    data: PushFrameRequest,
    db: Session = Depends(get_db),
):
    """
    Push a video frame from a browser/mobile camera.
    The browser calls this at regular intervals (e.g. every 100ms).
    """
    cam = camera_service.get_by_id(db, camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {camera_id} not found")

    success, message = camera_manager.push_frame(camera_id, data.frame)
    if not success:
        raise HTTPException(400, message)

    return {"success": True, "message": message}
