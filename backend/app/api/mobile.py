"""
mobile.py — Mobile camera and WebRTC camera client API.

Endpoints:
  POST   /api/mobile/sessions               → create a new mobile camera session (returns QR data)
  GET    /api/mobile/sessions               → list all sessions
  GET    /api/mobile/sessions/{session_id}  → get one session
  DELETE /api/mobile/sessions/{session_id}  → cancel session
  GET    /api/mobile/server-info            → LAN IP, port, URLs
  WS     /api/mobile/signal/{session_id}    → WebRTC signaling channel (phone connects here)
  POST   /api/mobile/frame/{session_id}     → push a JPEG frame (primary flow)
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.network import get_server_info
from app.core.session_manager import session_manager
from app.core.websocket_manager import manager as ws_manager
from app.database.session import SessionLocal, get_db
from app.services import camera_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mobile", tags=["mobile"])


# ─── Request models ───────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    camera_id: int
    camera_name: str
    device_type: str = "mobile"   # mobile | browser_client


class FramePushRequest(BaseModel):
    frame: str       # base64 JPEG (may be empty string for status pings)


# ─── Server info ─────────────────────────────────────────────────────────────

@router.get("/server-info")
def server_info():
    """Returns LAN IP, port, and connection URLs."""
    return get_server_info()


# ─── Session management ───────────────────────────────────────────────────────

@router.post("/sessions")
def create_session(data: CreateSessionRequest, db: Session = Depends(get_db)):
    """Create a camera connection session. Returns QR data and connection URL."""
    cam = camera_service.get_by_id(db, data.camera_id)
    if cam is None:
        raise HTTPException(404, f"Camera {data.camera_id} not found")

    session = session_manager.create_session(
        camera_id=data.camera_id,
        camera_name=data.camera_name,
        device_type=data.device_type,
    )

    info = get_server_info()
    connect_url = f"{info['base_url']}/mobile-camera?session={session.session_id}"
    qr_data = connect_url

    return {
        "session_id": session.session_id,
        "camera_id": data.camera_id,
        "camera_name": data.camera_name,
        "device_type": data.device_type,
        "status": session.status,
        "connect_url": connect_url,
        "qr_data": qr_data,
        "server_info": info,
    }


@router.get("/sessions")
def list_sessions():
    """List all active camera sessions."""
    return session_manager.get_all_sessions()


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    """Get a specific session."""
    s = session_manager.get_session(session_id)
    if s is None:
        raise HTTPException(404, "Session not found or expired")
    return {
        "session_id": s.session_id,
        "camera_id": s.camera_id,
        "camera_name": s.camera_name,
        "device_type": s.device_type,
        "status": s.status,
        "device_name": s.device_name,
        "device_ip": s.device_ip,
        "frames_received": s.frames_received,
        "connection_error": s.connection_error,
    }


@router.delete("/sessions/{session_id}", status_code=204)
async def cancel_session(session_id: str):
    """Cancel a session."""
    s = session_manager.get_session(session_id)
    if s:
        session_manager.expire_session(session_id)
        from app.core.camera_adapters import camera_manager
        if camera_manager.is_running(s.camera_id):
            await camera_manager.stop_camera(s.camera_id)


# ─── WebRTC Signaling WebSocket ──────────────────────────────────────────────

@router.websocket("/signal/{session_id}")
async def signaling_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """
    WebRTC signaling channel.
    The remote device (phone/laptop) connects here to exchange SDP/ICE candidates.
    The backend relays signaling messages to the dashboard via the main WebSocket.
    """
    if not session_manager.validate_session(session_id):
        await websocket.close(code=4004, reason="Invalid or expired session")
        return

    await websocket.accept()
    session = session_manager.get_session(session_id)
    if session is None:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Record device IP
    client_host = websocket.client.host if websocket.client else "unknown"
    session.device_ip = client_host
    session_manager.register_signaling_ws(session_id, websocket)
    logger.info("Signaling WS connected: session=%s ip=%s", session_id, client_host)

    # Notify dashboard: device is connecting
    await ws_manager.broadcast("camera_session_update", {
        "session_id": session_id,
        "camera_id": session.camera_id,
        "status": "CONNECTING",
        "device_ip": client_host,
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "device_info":
                session.device_name = data.get("device_name", "Remote Device")
                session.device_ip = data.get("ip", client_host)

            elif msg_type == "offer":
                await ws_manager.broadcast("webrtc_signal", {
                    "session_id": session_id,
                    "camera_id": session.camera_id,
                    "type": "offer",
                    "sdp": data.get("sdp"),
                })

            elif msg_type == "ice_candidate":
                await ws_manager.broadcast("webrtc_signal", {
                    "session_id": session_id,
                    "camera_id": session.camera_id,
                    "type": "ice_candidate",
                    "candidate": data.get("candidate"),
                })

            elif msg_type == "answer":
                await ws_manager.broadcast("webrtc_signal", {
                    "session_id": session_id,
                    "camera_id": session.camera_id,
                    "type": "answer",
                    "sdp": data.get("sdp"),
                })

            elif msg_type == "stream_started":
                session_manager.set_status(session_id, "ONLINE")
                session.device_name = data.get("device_name", session.device_name or "Remote Device")
                from app.core.camera_adapters import camera_manager
                if not camera_manager.is_running(session.camera_id):
                    await camera_manager.start_camera(
                        camera_id=session.camera_id,
                        adapter_type="webrtc",
                        config={},
                        db_session_factory=SessionLocal,
                        ws_manager=ws_manager,
                    )
                await ws_manager.broadcast("camera_session_update", {
                    "session_id": session_id,
                    "camera_id": session.camera_id,
                    "status": "ONLINE",
                    "device_name": session.device_name,
                    "device_ip": client_host,
                    "stream_type": "webrtc",
                })

            elif msg_type == "stream_stopped":
                session_manager.set_status(session_id, "OFFLINE")
                await ws_manager.broadcast("camera_session_update", {
                    "session_id": session_id,
                    "camera_id": session.camera_id,
                    "status": "OFFLINE",
                })

    except WebSocketDisconnect:
        logger.info("Signaling WS disconnected: session=%s", session_id)
    except Exception as exc:
        logger.error("Signaling error session=%s: %s", session_id, exc)
    finally:
        session.signaling_ws = None
        if session.status == "ONLINE":
            session_manager.set_status(session_id, "OFFLINE")
            from app.core.camera_adapters import camera_manager
            if camera_manager.is_running(session.camera_id):
                await camera_manager.stop_camera(session.camera_id)
            await ws_manager.broadcast("camera_session_update", {
                "session_id": session_id,
                "camera_id": session.camera_id,
                "status": "OFFLINE",
            })


# ─── Frame push (primary flow for mobile) ────────────────────────────────────

@router.post("/frame/{session_id}")
async def push_frame_by_session(
    session_id: str,
    data: FramePushRequest,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Primary frame push endpoint for mobile devices.
    The phone POSTs base64 JPEG frames here at ~10fps.
    Empty frame string is accepted as a session ping/keepalive.
    """
    if not session_manager.validate_session(session_id):
        raise HTTPException(401, "Invalid or expired session")

    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")

    # Empty frame = status ping only (used by startCamera() on first call)
    if not data.frame:
        return {
            "success": True,
            "message": "ping ok",
            "frames_received": session.frames_received,
            "status": session.status,
        }

    # First real frame — transition to ONLINE and start worker
    if session.status in ("WAITING", "CONNECTING"):
        session_manager.set_status(session_id, "ONLINE")
        if session.device_ip is None and request:
            session.device_ip = request.client.host
        from app.core.camera_adapters import camera_manager
        if not camera_manager.is_running(session.camera_id):
            await camera_manager.start_camera(
                camera_id=session.camera_id,
                adapter_type="webrtc",
                config={},
                db_session_factory=SessionLocal,
                ws_manager=ws_manager,
            )
            await ws_manager.broadcast("camera_session_update", {
                "session_id": session_id,
                "camera_id": session.camera_id,
                "status": "ONLINE",
                "stream_type": "frame_push",
                "device_ip": session.device_ip,
            })

    # Push frame to the camera worker
    from app.core.camera_adapters import camera_manager
    ok, msg = camera_manager.push_frame(session.camera_id, data.frame)
    if ok:
        session_manager.record_frame(session_id)

    return {
        "success": ok,
        "message": msg,
        "frames_received": session.frames_received,
        "status": session.status,
    }
