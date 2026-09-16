from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.schemas.incident import IncidentCreate, IncidentResponse
from app.services import incident_service
from app.core.websocket_manager import manager as ws_manager

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return incident_service.get_all(db, status=status)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = incident_service.get_by_id(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return incident


@router.post("", response_model=IncidentResponse, status_code=201)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    return incident_service.create(db, data)


@router.patch("/{incident_id}/acknowledge", response_model=IncidentResponse)
async def acknowledge_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = incident_service.acknowledge(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    await ws_manager.broadcast("incident_updated", {"id": incident_id, "status": "ACKNOWLEDGED"})
    return incident


@router.patch("/{incident_id}/resolve", response_model=IncidentResponse)
async def resolve_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = incident_service.resolve(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    await ws_manager.broadcast("incident_updated", {"id": incident_id, "status": "RESOLVED"})
    return incident


@router.delete("/{incident_id}", status_code=204)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident_service.delete(db, incident_id)
