"""
Tests for GET /api/dashboard/summary.
"""

from datetime import datetime, timezone

from app.models.camera import Camera
from app.models.incident import Incident
from app.models.system_status import SystemStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _insert_camera(db, code, name, location, status="ONLINE"):
    cam = Camera(
        camera_code=code,
        name=name,
        location=location,
        status=status,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


def _insert_incident(db, severity, confidence, status="ACTIVE"):
    inc = Incident(
        incident_type="Accident",
        severity=severity,
        confidence=confidence,
        location="Test Zone",
        status=status,
        detected_at=datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc


def _insert_system_status(db, service_name, status="ONLINE"):
    record = SystemStatus(service_name=service_name, status=status)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_dashboard_summary_returns_200(client, db_session):
    """GET /api/dashboard/summary returns 200."""
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200


def test_dashboard_summary_contains_all_required_fields(client, db_session):
    """Dashboard summary response includes every required aggregate field."""
    response = client.get("/api/dashboard/summary")
    body = response.json()
    required_fields = (
        "active_incident_count",
        "critical_count",
        "warning_count",
        "cameras_connected",
        "cameras_offline",
        "total_cameras",
        "monitoring_active",
        "detections_today",
        "alert_count",
        "average_ai_confidence",
        "recent_incidents",
        "system_health",
    )
    for field in required_fields:
        assert field in body, f"Missing field: {field}"


def test_dashboard_summary_aggregates_correctly(client, db_session):
    """Dashboard summary reflects the DB state accurately."""
    # 4 cameras (3 ONLINE, 1 OFFLINE)
    _insert_camera(db_session, "CAM-01", "Main Entrance", "Front", status="ONLINE")
    _insert_camera(db_session, "CAM-02", "Parking Area", "Parking", status="ONLINE")
    _insert_camera(db_session, "CAM-03", "Corridor", "Corridor A", status="ONLINE")
    _insert_camera(db_session, "CAM-04", "Restricted", "Zone R", status="OFFLINE")

    # 3 ACTIVE incidents (1 CRITICAL, 2 HIGH)
    _insert_incident(db_session, severity="CRITICAL", confidence=0.90, status="ACTIVE")
    _insert_incident(db_session, severity="HIGH",     confidence=0.80, status="ACTIVE")
    _insert_incident(db_session, severity="HIGH",     confidence=0.70, status="ACTIVE")
    # 1 resolved — should NOT appear in active counts
    _insert_incident(db_session, severity="CRITICAL", confidence=1.0, status="RESOLVED")

    # 2 system statuses
    _insert_system_status(db_session, "AI Engine")
    _insert_system_status(db_session, "Database")

    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    body = response.json()

    assert body["active_incident_count"] == 3
    assert body["critical_count"] == 1
    assert body["warning_count"] == 2       # HIGH counts as warning
    assert body["cameras_connected"] == 3
    assert body["cameras_offline"] == 1
    assert body["total_cameras"] == 4

    # average_ai_confidence of the 3 ACTIVE incidents = (0.90 + 0.80 + 0.70) / 3 = 0.8
    assert abs(body["average_ai_confidence"] - 0.8) < 0.01

    assert isinstance(body["recent_incidents"], list)
    assert isinstance(body["system_health"], list)
    assert len(body["system_health"]) == 2


def test_dashboard_summary_confidence_zero_when_no_active_incidents(client, db_session):
    """average_ai_confidence is 0.0 when there are no active incidents."""
    response = client.get("/api/dashboard/summary")
    body = response.json()
    assert body["average_ai_confidence"] == 0.0
    assert body["active_incident_count"] == 0
