"""
test_supabase_integration.py — Integration tests for Supabase-aware API endpoints.

These tests verify that:
  - All protected endpoints work without authentication when Supabase is not configured
  - The /api/health endpoint reports Supabase status correctly
  - Camera, incident, and alert endpoints remain accessible in local-dev mode
"""
import os
import pytest

# Ensure Supabase is NOT configured for these tests (local-dev mode)
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)


def test_health_endpoint_accessible(client):
    """Health endpoint must be reachable without auth."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_cameras_list_accessible_without_auth(client):
    """Camera list must work in local-dev mode (no Supabase)."""
    resp = client.get("/api/cameras")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_incidents_list_accessible_without_auth(client):
    """Incidents list must work in local-dev mode."""
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_alerts_list_accessible_without_auth(client):
    """Alerts list must work in local-dev mode."""
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_dashboard_summary_accessible_without_auth(client):
    """Dashboard summary must work in local-dev mode."""
    resp = client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    # All counts must be 0 or more (never negative or fake)
    assert data["total_cameras"] >= 0
    assert data["active_incident_count"] >= 0
    assert data["cameras_online_count"] >= 0


def test_system_health_accessible_without_auth(client):
    """System health must work in local-dev mode."""
    resp = client.get("/api/system-health")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_network_info_endpoint(client):
    """Network info endpoint returns expected keys."""
    resp = client.get("/api/network-info")
    assert resp.status_code == 200
    data = resp.json()
    assert "lan_ip" in data
    assert "port" in data
    assert "scheme" in data
    assert "base_url" in data


def test_recognition_status_accessible(client):
    """Recognition status endpoint returns expected structure."""
    resp = client.get("/api/recognition/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "model_ready" in data
    assert "registered_persons" in data


def test_persons_list_accessible_without_auth(client):
    """Persons list must work in local-dev mode."""
    resp = client.get("/api/persons")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_no_fake_data_on_empty_db(client):
    """
    On a fresh empty database:
    - cameras list must be empty
    - incidents must be empty
    - dashboard counts must all be 0
    """
    resp_cams = client.get("/api/cameras")
    resp_incs = client.get("/api/incidents")
    resp_dash = client.get("/api/dashboard/summary")

    assert resp_cams.status_code == 200
    assert resp_incs.status_code == 200
    assert resp_dash.status_code == 200

    assert resp_cams.json() == [], "Cameras must be empty on fresh DB — no fake data"
    assert resp_incs.json() == [], "Incidents must be empty on fresh DB — no fake data"

    dash = resp_dash.json()
    assert dash["total_cameras"] == 0, "total_cameras must be 0 on fresh DB"
    assert dash["cameras_online_count"] == 0, "cameras_online must be 0 on fresh DB"
    assert dash["active_incident_count"] == 0, "active incidents must be 0 on fresh DB"
    assert dash["critical_count"] == 0, "critical count must be 0 on fresh DB"
    assert dash["alert_count"] == 0, "alert count must be 0 on fresh DB"
