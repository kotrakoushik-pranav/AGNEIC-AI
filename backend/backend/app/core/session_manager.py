"""
session_manager.py — Camera session registry.

Manages:
- Mobile/browser camera sessions (WebRTC push-based)
- Session lifecycle: WAITING → CONNECTING → ONLINE → OFFLINE
- QR code generation
- Session expiry (unused sessions cleaned after 10 minutes)
"""
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

SESSION_EXPIRY_SECONDS = int(os.getenv("SESSION_EXPIRY_SECONDS", "600"))  # 10 min


@dataclass
class CameraSession:
    session_id: str
    camera_id: int
    camera_name: str
    device_type: str          # mobile | browser_client | webrtc
    status: str = "WAITING"   # WAITING | CONNECTING | ONLINE | OFFLINE | ERROR
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    stream_type: str = "webrtc"
    created_at: float = field(default_factory=time.monotonic)
    last_activity: float = field(default_factory=time.monotonic)
    # WebSocket for signaling with the remote device
    signaling_ws: Optional[WebSocket] = None
    frames_received: int = 0
    last_frame_at: Optional[float] = None
    connection_error: Optional[str] = None


class SessionManager:
    def __init__(self):
        self._sessions: Dict[str, CameraSession] = {}    # session_id → session
        self._camera_sessions: Dict[int, str] = {}        # camera_id → session_id

    def create_session(
        self,
        camera_id: int,
        camera_name: str,
        device_type: str = "mobile",
    ) -> CameraSession:
        session_id = secrets.token_urlsafe(12)
        session = CameraSession(
            session_id=session_id,
            camera_id=camera_id,
            camera_name=camera_name,
            device_type=device_type,
        )
        self._sessions[session_id] = session
        self._camera_sessions[camera_id] = session_id
        logger.info("Session created: %s for camera %d", session_id, camera_id)
        return session

    def get_session(self, session_id: str) -> Optional[CameraSession]:
        s = self._sessions.get(session_id)
        if s:
            s.last_activity = time.monotonic()
        return s

    def get_session_for_camera(self, camera_id: int) -> Optional[CameraSession]:
        sid = self._camera_sessions.get(camera_id)
        if sid:
            return self._sessions.get(sid)
        return None

    def validate_session(self, session_id: str) -> bool:
        s = self._sessions.get(session_id)
        if s is None:
            return False
        age = time.monotonic() - s.created_at
        if age > SESSION_EXPIRY_SECONDS and s.status == "WAITING":
            self.expire_session(session_id)
            return False
        return True

    def expire_session(self, session_id: str):
        s = self._sessions.pop(session_id, None)
        if s:
            self._camera_sessions.pop(s.camera_id, None)
            logger.info("Session expired: %s", session_id)

    def set_status(self, session_id: str, status: str, error: str = None):
        s = self._sessions.get(session_id)
        if s:
            s.status = status
            if error:
                s.connection_error = error
            s.last_activity = time.monotonic()

    def register_signaling_ws(self, session_id: str, ws: WebSocket):
        s = self._sessions.get(session_id)
        if s:
            s.signaling_ws = ws
            s.status = "CONNECTING"

    def record_frame(self, session_id: str):
        s = self._sessions.get(session_id)
        if s:
            s.frames_received += 1
            s.last_frame_at = time.monotonic()

    def get_all_sessions(self) -> List[dict]:
        result = []
        for s in self._sessions.values():
            result.append({
                "session_id": s.session_id,
                "camera_id": s.camera_id,
                "camera_name": s.camera_name,
                "device_type": s.device_type,
                "status": s.status,
                "device_name": s.device_name,
                "device_ip": s.device_ip,
                "stream_type": s.stream_type,
                "frames_received": s.frames_received,
                "last_frame_at": s.last_frame_at,
                "connection_error": s.connection_error,
                "age_seconds": round(time.monotonic() - s.created_at, 1),
            })
        return result

    async def cleanup_expired(self):
        now = time.monotonic()
        expired = [
            sid for sid, s in self._sessions.items()
            if s.status == "WAITING" and (now - s.created_at) > SESSION_EXPIRY_SECONDS
        ]
        for sid in expired:
            self.expire_session(sid)


# Singleton
session_manager = SessionManager()
