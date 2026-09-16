"""
Tests for GET /api/cameras and GET /api/cameras/{id}.

Covers:
  - 200 list endpoint (returns an array)
  - 200 single-camera fetch by ID
  - 404 when the camera does not exist
"""

from datetime import datetime, timezone

from app.models.camera import Camera


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_camera(db, code="CAM-01", name="Main Entrance", location="Front Door"):
    cam = Camera(
        camera_code=code,
        name=name,
        location=location,
        status="ONLINE",
        stream_url=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_list_cameras_returns_200(client, db_session):
    """GET /api/cameras with no rows still returns 200 and an empty list."""
    response = client.get("/api/cameras")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_cameras_returns_seeded_records(client, db_session):
    """GET /api/cameras returns all inserted camera records."""
    _make_camera(db_session, code="CAM-01", name="Main Entrance")
    _make_camera(db_session, code="CAM-02", name="Parking Area")

    response = client.get("/api/cameras")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    codes = {c["camera_code"] for c in data}
    assert codes == {"CAM-01", "CAM-02"}


def test_get_camera_by_id_returns_200(client, db_session):
    """GET /api/cameras/{id} returns the correct camera."""
    cam = _make_camera(db_session)

    response = client.get(f"/api/cameras/{cam.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == cam.id
    assert body["camera_code"] == "CAM-01"
    assert body["name"] == "Main Entrance"
    assert body["status"] == "ONLINE"
    # All required fields present
    for field in ("id", "camera_code", "name", "location", "status", "stream_url",
                  "created_at", "updated_at"):
        assert field in body


def test_get_camera_not_found_returns_404(client, db_session):
    """GET /api/cameras/999 returns 404 with a detail message."""
    response = client.get("/api/cameras/999")
    assert response.status_code == 404
    assert "detail" in response.json()
