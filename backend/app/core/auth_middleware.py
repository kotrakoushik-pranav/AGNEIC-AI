"""
auth_middleware.py — Optional Supabase JWT authentication dependency.

Usage in a router:
    from app.core.auth_middleware import get_current_user, CurrentUser
    
    @router.get("/protected")
    def protected(user: CurrentUser = Depends(get_current_user)):
        return {"user_id": user["id"]}

When SUPABASE_SERVICE_ROLE_KEY is not configured, get_current_user returns
a guest/anonymous user dict so the backend works without Supabase for
local development.

IMPORTANT: Never log or return the JWT token to clients.
"""
import logging
from typing import Optional, Annotated

from fastapi import Depends, HTTPException, Header
from app.core.supabase_client import verify_supabase_jwt, supabase_enabled

logger = logging.getLogger(__name__)

# Type alias for routes that require auth
CurrentUser = dict  # {"id": str, "email": str, "role": str}

# Fallback user when Supabase is not configured (local dev)
_LOCAL_DEV_USER: CurrentUser = {
    "id": "local-dev-user",
    "email": "dev@localhost",
    "role": "admin",
}


def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> CurrentUser:
    """
    FastAPI dependency that extracts and validates the Supabase JWT.

    If Supabase is NOT configured: returns a local-dev user (no auth required).
    If Supabase IS configured but no token: raises 401.
    If token is invalid: raises 401.
    """
    if not supabase_enabled():
        # Local development — auth not required
        return _LOCAL_DEV_USER

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Include 'Authorization: Bearer <token>' header.",
        )

    # Extract "Bearer <token>"
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
        )

    token = parts[1]
    user = verify_supabase_jwt(token)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )

    return user


def get_optional_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[CurrentUser]:
    """
    Like get_current_user but returns None instead of raising 401.
    Use for endpoints that work both authenticated and unauthenticated.
    """
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None
