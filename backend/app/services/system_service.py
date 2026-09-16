from datetime import datetime, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.camera import Camera
from app.models.detection import Detection
from app.models.incident import Incident
from app.models.system_status import SystemStatus
from app.schemas.dashboard import DashboardSummary
from app.schemas.incident import IncidentResponse
from app.schemas.system_status import SystemStatusResponse


def get_all_statuses(db: Session) -> List[SystemStatus]:
    return db.query(SystemStatus).all()


def get_dashboard_summary(db: Session) -> DashboardSummary:
    # Active incidents
    active_incidents = db.query(Incident).filter(Incident.status == "ACTIVE").all()
    active_count = len(active_incidents)
    critical_count = sum(1 for i in active_incidents if i.severity == "CRITICAL")
    warning_count = sum(1 for i in active_incidents if i.severity in ("HIGH", "MEDIUM"))

    avg_confidence = 0.0
    if active_incidents:
        avg_confidence = sum(i.confidence for i in active_incidents) / len(active_incidents)

    # Camera counts — based on DB status (worker updates this in real time)
    cameras_online = db.query(Camera).filter(Camera.status == "ONLINE").count()
    cameras_offline = db.query(Camera).filter(
        Camera.status.in_(["OFFLINE", "ERROR", "DISCONNECTED"])
    ).count()
    total_cameras = db.query(Camera).count()

    # Any camera currently monitoring
    monitoring_active = (
        db.query(Camera).filter(Camera.is_monitoring == True).count() > 0  # noqa: E712
    )

    # Detections today
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    detections_today = (
        db.query(Detection).filter(Detection.detected_at >= today_start).count()
    )

    # Active alert count
    alert_count = db.query(Alert).filter(Alert.status == "ACTIVE").count()

    # Recent incidents (last 5)
    recent = (
        db.query(Incident).order_by(Incident.detected_at.desc()).limit(5).all()
    )

    # System health
    health = db.query(SystemStatus).all()

    return DashboardSummary(
        cameras_online_count=cameras_online,
        cameras_connected=cameras_online,   # alias for test/legacy compatibility
        cameras_offline=cameras_offline,
        total_cameras=total_cameras,
        monitoring_active=monitoring_active,
        detections_today=detections_today,
        active_incident_count=active_count,
        critical_count=critical_count,
        warning_count=warning_count,
        alert_count=alert_count,
        average_ai_confidence=round(avg_confidence, 3),
        recent_incidents=[IncidentResponse.model_validate(i) for i in recent],
        system_health=[SystemStatusResponse.model_validate(s) for s in health],
    )
