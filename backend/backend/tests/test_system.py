"""
Tests for GET /api/system-health.
"""

from app.models.system_status import SystemStatus


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _insert_system_status(db, service_name="AI Engine", status="ONLINE"):
    record = SystemStatus(service_name=service_name, status=status)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_system_health_returns_200(client, db_session):
    """GET /api/system-health returns 200 with a list."""
    response = client.get("/api/system-health")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_system_health_returns_inserted_records(client, db_session):
    """GET /api/system-health returns all inserted SystemStatus records."""
    _insert_system_status(db_session, service_name="AI Engine", status="ONLINE")
    _insert_system_status(db_session, service_name="Database", status="ONLINE")

    response = client.get("/api/system-health")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {r["service_name"] for r in data}
    assert names == {"AI Engine", "Database"}
    # All required response fields present on each record
    for record in data:
        for field in ("id", "service_name", "status", "last_updated"):
            assert field in record
