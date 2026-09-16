"""
Tests for the incident action endpoints:
  PATCH /api/incidents/{id}/acknowledge  — 200 / 404
  PATCH /api/incidents/{id}/resolve      — 200 / 404
"""

from datetime import datetime, timezone

from app.models.incident import Incident


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _insert_active_incident(db):
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
    return incident


# ---------------------------------------------------------------------------
# PATCH acknowledge
# ---------------------------------------------------------------------------

def test_acknowledge_incident_returns_200(client, db_session):
    """PATCH acknowledge returns 200 with the updated incident."""
    inc = _insert_active_incident(db_session)

    response = client.patch(f"/api/incidents/{inc.id}/acknowledge")
    assert response.status_code == 200


def test_acknowledge_incident_sets_status_acknowledged(client, db_session):
    """After PATCH acknowledge, status becomes ACKNOWLEDGED."""
    inc = _insert_active_incident(db_session)

    response = client.patch(f"/api/incidents/{inc.id}/acknowledge")
    body = response.json()
    assert body["status"] == "ACKNOWLEDGED"
    assert body["acknowledged_at"] is not None


def test_acknowledge_nonexistent_incident_returns_404(client, db_session):
    """PATCH acknowledge on a non-existent ID returns 404."""
    response = client.patch("/api/incidents/999/acknowledge")
    assert response.status_code == 404
    assert "detail" in response.json()


# ---------------------------------------------------------------------------
# PATCH resolve
# ---------------------------------------------------------------------------

def test_resolve_incident_returns_200(client, db_session):
    """PATCH resolve returns 200 with the updated incident."""
    inc = _insert_active_incident(db_session)

    response = client.patch(f"/api/incidents/{inc.id}/resolve")
    assert response.status_code == 200


def test_resolve_incident_sets_status_resolved(client, db_session):
    """After PATCH resolve, status becomes RESOLVED."""
    inc = _insert_active_incident(db_session)

    response = client.patch(f"/api/incidents/{inc.id}/resolve")
    body = response.json()
    assert body["status"] == "RESOLVED"
    assert body["resolved_at"] is not None


def test_resolve_nonexistent_incident_returns_404(client, db_session):
    """PATCH resolve on a non-existent ID returns 404."""
    response = client.patch("/api/incidents/999/resolve")
    assert response.status_code == 404
    assert "detail" in response.json()
