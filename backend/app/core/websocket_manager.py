import json
import logging
from typing import List, Any, Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages active WebSocket connections and broadcasts real-time events."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            "WebSocket client connected. Total: %d", len(self.active_connections)
        )

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            "WebSocket client disconnected. Total: %d", len(self.active_connections)
        )

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcast a JSON event to all connected clients."""
        message = json.dumps({"type": event_type, "data": data})
        dead: List[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.disconnect(d)

    async def broadcast_camera_status(self, camera_id: int, status: str, is_monitoring: bool):
        await self.broadcast("camera_status", {
            "camera_id": camera_id,
            "status": status,
            "is_monitoring": is_monitoring,
        })

    async def broadcast_detection(self, detection: Dict[str, Any]):
        await self.broadcast("detection", detection)

    async def broadcast_incident(self, incident: Dict[str, Any]):
        await self.broadcast("incident_created", incident)

    async def broadcast_alert(self, alert: Dict[str, Any]):
        await self.broadcast("alert_created", alert)

    async def broadcast_monitoring_status(self, camera_id: int, active: bool):
        await self.broadcast("monitoring_status", {
            "camera_id": camera_id,
            "active": active,
        })


# Singleton
manager = WebSocketManager()
