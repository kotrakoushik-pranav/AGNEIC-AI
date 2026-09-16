"""
Tests for the Incidents CRUD endpoints:
  GET  /api/incidents            — 200, list
  GET  /api/incidents/{id}       — 200 / 404
  POST /api/incidents            — 201 created / 422 validation errors
"""

from datetime import datetime, timezone

from app.models.incident import Incident


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DETECTED = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)

VALID_PAYLOAD = {
    "incident_type": "Accident",
    "severity": "CRITICAL",
    "confidence": 0.95,
    "location": "Parking Area",
    "description": "Possible vehicle collision",
    "camera_id": None,
    "detected_at": _DETECTED.isoformat(),
}


def _insert_incident(db, **overrides):
    data = dict(
        incident_type="Accident",
        severity="HIGH",
        confidence=0.80,
        location="Main Entrance",
        status="ACTIVE",
        detected_at=_DETECTED,
    )
    data.update(overrides)
    incident = Incident(**data)
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


# ---------------------------------------------------------------------------
# GET /api/incidents
# ---------------------------------------------------------------------------

def test_list_incidents_returns_200(client, db_session):
    """GET /api/incidents returns 200 with a list (may be empty)."""
    response = client.get("/api/incidents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_incidents_returns_records(client, db_session):
    """GET /api/incidents returns all inserted incident records."""
    _insert_incident(db_session, incident_type="Accident", severity="CRITICAL")
    _insert_incident(db_session, incident_type="Fire", severity="HIGH")

    response = client.get("/api/incidents")
    assert response.status_code == 200
    assert len(response.json()) == 2


# ---------------------------------------------------------------------------
# GET /api/incidents/{id}
# ---------------------------------------------------------------------------

def test_get_incident_by_id_returns_200(client, db_session):
    """GET /api/incidents/{id} returns the correct incident."""
    inc = _insert_incident(db_session)

    response = client.get(f"/api/incidents/{inc.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == inc.id
    assert body["severity"] == "HIGH"
    assert body["status"] == "ACTIVE"
    # All required response fields present
    for field in ("id", "incident_type", "severity", "confidence", "location",
                  "status", "detected_at", "created_at"):
        assert field in body


def test_get_incident_not_found_returns_404(client, db_session):
    """GET /api/incidents/999 returns 404 with detail."""
    response = client.get("/api/incidents/999")
    assert response.status_code == 404
    assert "detail" in response.json()


# ---------------------------------------------------------------------------
# POST /api/incidents — happy path
# ---------------------------------------------------------------------------

def test_create_incident_returns_201(client, db_session):
    """POST /api/incidents with valid body returns 201 and the created record."""
    response = client.post("/api/incidents", json=VALID_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["incident_type"] == "Accident"
    assert body["severity"] == "CRITICAL"
    assert body["confidence"] == 0.95
    assert body["location"] == "Parking Area"
    assert body["status"] == "ACTIVE"
    assert "id" in body


# ---------------------------------------------------------------------------
# POST /api/incidents — validation failures (422)
# ---------------------------------------------------------------------------

def test_create_incident_missing_required_field_returns_422(client, db_session):
    """POST without required `location` field returns 422."""
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "location"}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422


def test_create_incident_missing_severity_returns_422(client, db_session):
    """POST without required `severity` field returns 422."""
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "severity"}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422


def test_create_incident_confidence_above_range_returns_422(client, db_session):
    """POST with confidence > 1.0 returns 422."""
    payload = {**VALID_PAYLOAD, "confidence": 1.5}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422


def test_create_incident_confidence_below_range_returns_422(client, db_session):
    """POST with confidence < 0.0 returns 422."""
    payload = {**VALID_PAYLOAD, "confidence": -0.1}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422


def test_create_incident_invalid_severity_returns_422(client, db_session):
    """POST with a severity value not in the allowed enum returns 422."""
    payload = {**VALID_PAYLOAD, "severity": "EXTREME"}
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422
