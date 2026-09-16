from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate


def get_all(db: Session, status: Optional[str] = None) -> List[Incident]:
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    return query.order_by(Incident.detected_at.desc()).all()


def get_by_id(db: Session, incident_id: int) -> Optional[Incident]:
    return db.query(Incident).filter(Incident.id == incident_id).first()


def create(db: Session, data: IncidentCreate) -> Incident:
    incident = Incident(**data.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


def acknowledge(db: Session, incident_id: int) -> Optional[Incident]:
    incident = get_by_id(db, incident_id)
    if incident is None:
        return None
    incident.acknowledged_at = datetime.now(timezone.utc)
    incident.status = "ACKNOWLEDGED"
    db.commit()
    db.refresh(incident)
    return incident


def resolve(db: Session, incident_id: int) -> Optional[Incident]:
    incident = get_by_id(db, incident_id)
    if incident is None:
        return None
    incident.resolved_at = datetime.now(timezone.utc)
    incident.status = "RESOLVED"
    db.commit()
    db.refresh(incident)
    return incident
