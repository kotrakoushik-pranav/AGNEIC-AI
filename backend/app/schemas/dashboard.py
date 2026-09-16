from typing import List
from pydantic import BaseModel

from app.schemas.incident import IncidentResponse
from app.schemas.system_status import SystemStatusResponse


class DashboardSummary(BaseModel):
    cameras_online_count: int
    # Alias used by tests and legacy callers
    cameras_connected: int = 0
    cameras_offline: int
    total_cameras: int
    monitoring_active: bool
    detections_today: int
    active_incident_count: int
    critical_count: int
    warning_count: int
    alert_count: int
    average_ai_confidence: float
    recent_incidents: List[IncidentResponse]
    system_health: List[SystemStatusResponse]
