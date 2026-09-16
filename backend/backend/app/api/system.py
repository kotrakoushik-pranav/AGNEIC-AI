from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any, Dict, List
from app.database.session import get_db
from app.schemas.system_status import SystemStatusResponse
from app.services import system_service

router = APIRouter(prefix="/system-health", tags=["system"])


@router.get("", response_model=List[SystemStatusResponse])
def get_system_health(db: Session = Depends(get_db)):
    return system_service.get_all_statuses(db)


# ── Location endpoint ─────────────────────────────────────────────────────────
# A separate router so this lives at /api/location (not under /api/system-health)
_location_router = APIRouter(tags=["system"])


@_location_router.get("/location")
def get_system_location() -> Dict[str, Any]:
    """Returns the system demo location for map centering."""
    return {
        "latitude": 17.3850,
        "longitude": 78.4867,
        "label": "Hyderabad",
        "source": "demo",
    }
