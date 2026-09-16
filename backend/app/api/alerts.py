from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.session import get_db
from app.schemas.alert import AlertResponse
from app.services import alert_service
from app.core.websocket_manager import manager as ws_manager

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertResponse])
def list_alerts(db: Session = Depends(get_db)):
    return alert_service.get_all(db)


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = alert_service.acknowledge(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    await ws_manager.broadcast("alert_updated", {"id": alert_id, "status": "ACKNOWLEDGED"})
    return alert
