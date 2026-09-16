from app.schemas.camera import CameraCreate, CameraResponse, CameraStatusUpdate
from app.schemas.detection import DetectionCreate, DetectionResponse
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from app.schemas.alert import AlertResponse
from app.schemas.system_status import SystemStatusResponse
from app.schemas.dashboard import DashboardSummary

__all__ = [
    "CameraCreate", "CameraResponse", "CameraStatusUpdate",
    "DetectionCreate", "DetectionResponse",
    "IncidentCreate", "IncidentResponse", "IncidentUpdate",
    "AlertResponse",
    "SystemStatusResponse",
    "DashboardSummary",
]
