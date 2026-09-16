"""
supabase_client.py — Backend Supabase service-role client.

Uses the SERVICE ROLE KEY which has admin access bypassing RLS.
This key MUST stay server-side only — never in frontend code.

When SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set (local dev),
all functions silently no-op so the backend works without Supabase.
"""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
_SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# Initialise the Supabase client once
_client = None

def _get_client():
    """Lazy-initialise the service-role Supabase client."""
    global _client
    if _client is not None:
        return _client

    if not _SUPABASE_URL or not _SERVICE_KEY:
        return None

    if "placeholder" in _SUPABASE_URL or "YOUR_PROJECT_ID" in _SUPABASE_URL:
        return None

    try:
        from supabase import create_client, Client
        _client = create_client(_SUPABASE_URL, _SERVICE_KEY)
        logger.info("Supabase service-role client initialised.")
        return _client
    except Exception as exc:
        logger.warning("Failed to initialise Supabase client: %s", exc)
        return None


def supabase_enabled() -> bool:
    return _get_client() is not None


# ── Detection sync ────────────────────────────────────────────

def sync_detection_to_supabase(
    user_id: str,
    camera_supabase_id: Optional[str],
    detection_type: str,
    confidence: float,
    bounding_box: Optional[dict] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """
    Insert a detection record into Supabase.
    Returns the new detection UUID or None on failure/disabled.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        result = client.table("detections").insert({
            "user_id": user_id,
            "camera_id": camera_supabase_id,
            "detection_type": detection_type,
            "confidence": confidence,
            "bounding_box": bounding_box,
            "latitude": latitude,
            "longitude": longitude,
            "metadata": metadata,
        }).execute()

        if result.data:
            return result.data[0]["id"]
    except Exception as exc:
        logger.error("sync_detection_to_supabase: %s", exc)

    return None


# ── Incident sync ─────────────────────────────────────────────

def sync_incident_to_supabase(
    user_id: str,
    camera_supabase_id: Optional[str],
    incident_type: str,
    severity: str,
    title: str,
    description: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """Insert incident into Supabase. Returns UUID or None."""
    client = _get_client()
    if client is None:
        return None

    try:
        result = client.table("incidents").insert({
            "user_id": user_id,
            "camera_id": camera_supabase_id,
            "type": incident_type,
            "severity": severity,
            "title": title,
            "description": description,
            "status": "OPEN",
            "latitude": latitude,
            "longitude": longitude,
            "metadata": metadata,
        }).execute()

        if result.data:
            return result.data[0]["id"]
    except Exception as exc:
        logger.error("sync_incident_to_supabase: %s", exc)

    return None


# ── Alert sync ────────────────────────────────────────────────

def sync_alert_to_supabase(
    user_id: str,
    camera_supabase_id: Optional[str],
    incident_supabase_id: Optional[str],
    alert_type: str,
    severity: str,
    message: str,
) -> Optional[str]:
    """Insert alert into Supabase. Returns UUID or None."""
    client = _get_client()
    if client is None:
        return None

    try:
        result = client.table("alerts").insert({
            "user_id": user_id,
            "camera_id": camera_supabase_id,
            "incident_id": incident_supabase_id,
            "type": alert_type,
            "severity": severity,
            "message": message,
            "acknowledged": False,
        }).execute()

        if result.data:
            return result.data[0]["id"]
    except Exception as exc:
        logger.error("sync_alert_to_supabase: %s", exc)

    return None


# ── Camera status sync ────────────────────────────────────────

def sync_camera_status_to_supabase(
    camera_supabase_id: str,
    status: str,
) -> bool:
    """Update camera connection_status + last_seen in Supabase."""
    client = _get_client()
    if client is None:
        return False

    import datetime
    try:
        update_data: dict = {"connection_status": status}
        if status == "CONNECTED":
            update_data["last_seen"] = datetime.datetime.utcnow().isoformat() + "Z"

        client.table("cameras").update(update_data).eq("id", camera_supabase_id).execute()
        return True
    except Exception as exc:
        logger.error("sync_camera_status_to_supabase: %s", exc)
        return False


# ── Verify JWT token (for auth middleware) ────────────────────

def verify_supabase_jwt(token: str) -> Optional[dict]:
    """
    Verify a Supabase JWT token and return the user claims dict.
    Returns None if invalid or Supabase not configured.
    """
    client = _get_client()
    if client is None:
        return None

    try:
        result = client.auth.get_user(token)
        if result and result.user:
            return {
                "id": result.user.id,
                "email": result.user.email,
                "role": result.user.user_metadata.get("role", "operator"),
            }
    except Exception as exc:
        logger.debug("JWT verify failed: %s", exc)

    return None
