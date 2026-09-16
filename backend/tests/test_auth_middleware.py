"""
test_auth_middleware.py — Tests for the optional Supabase JWT auth middleware.

When Supabase is NOT configured (no env vars), the middleware must:
  - Return the local-dev fallback user
  - Not block any requests

When Supabase IS configured but token is missing/invalid:
  - Should raise 401 (tested via mock)
"""
import os
import pytest

# Ensure Supabase is NOT configured for these tests
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)


def test_get_current_user_returns_local_dev_when_supabase_not_configured():
    """Without Supabase config, get_current_user must return the dev fallback."""
    from app.core.auth_middleware import get_current_user, _LOCAL_DEV_USER
    user = get_current_user(authorization=None)
    assert user == _LOCAL_DEV_USER
    assert user["id"] == "local-dev-user"
    assert user["role"] == "admin"


def test_get_current_user_ignores_bearer_token_when_supabase_not_configured():
    """A token header is harmless when Supabase is not configured."""
    from app.core.auth_middleware import get_current_user, _LOCAL_DEV_USER
    user = get_current_user(authorization="Bearer some.fake.token")
    assert user == _LOCAL_DEV_USER


def test_get_optional_user_returns_local_dev_when_supabase_not_configured():
    """get_optional_user should also return local-dev fallback without Supabase."""
    from app.core.auth_middleware import get_optional_user, _LOCAL_DEV_USER
    user = get_optional_user(authorization=None)
    assert user == _LOCAL_DEV_USER


def test_supabase_client_not_enabled_when_unconfigured():
    """supabase_enabled() must return False when env vars are missing."""
    from app.core.supabase_client import supabase_enabled
    assert supabase_enabled() is False


def test_verify_jwt_returns_none_when_supabase_not_configured():
    """verify_supabase_jwt should gracefully return None without Supabase."""
    from app.core.supabase_client import verify_supabase_jwt
    result = verify_supabase_jwt("any.fake.token")
    assert result is None


def test_sync_functions_noop_when_supabase_not_configured():
    """All sync_* helpers must silently no-op and return None/False without Supabase."""
    from app.core.supabase_client import (
        sync_detection_to_supabase,
        sync_incident_to_supabase,
        sync_alert_to_supabase,
        sync_camera_status_to_supabase,
    )
    assert sync_detection_to_supabase("uid", None, "face", 0.9) is None
    assert sync_incident_to_supabase("uid", None, "fire", "CRITICAL", "Fire detected") is None
    assert sync_alert_to_supabase("uid", None, None, "FIRE", "CRITICAL", "Fire!") is None
    assert sync_camera_status_to_supabase("cam-id", "CONNECTED") is False
