"""
Tests for GET /api/alerts.
"""

from datetime import datetime, timezone

from app.models.alert import Alert
from app.models.incident import Incident


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _insert_incident_and_alert(db):
    incident = Incident(
        incident_type="Accident",
        severity="CRITICAL",
        confidence=0.94,
        location="Parking Area",
        status="ACTIVE",
        detected_at=datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    alert = Alert(
        incident_id=incident.id,
        alert_type="EMAIL",
        recipient="security@example.com",
        status="SENT",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_list_alerts_returns_200(client, db_session):
    """GET /api/alerts returns 200 with a list (may be empty)."""
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_alerts_returns_inserted_records(client, db_session):
    """GET /api/alerts returns the alert records inserted in the DB."""
    alert = _insert_incident_and_alert(db_session)

    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    body = data[0]
    assert body["id"] == alert.id
    assert body["alert_type"] == "EMAIL"
    assert body["recipient"] == "security@example.com"
    assert body["status"] == "SENT"
    # All required fields present
    for field in ("id", "incident_id", "alert_type", "recipient", "status",
                  "created_at", "acknowledged_at"):
        assert field in body
