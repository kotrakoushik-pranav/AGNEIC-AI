from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.session import get_db
from app.schemas.detection import DetectionResponse
from app.services import detection_service

router = APIRouter(prefix="/detections", tags=["detections"])


@router.get("", response_model=List[DetectionResponse])
def list_detections(
    camera_id: Optional[int] = Query(None),
    detection_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    return detection_service.get_all(db, camera_id=camera_id, detection_type=detection_type, limit=limit)


@router.get("/today-count")
def detections_today(db: Session = Depends(get_db)):
    return {"count": detection_service.count_today(db)}
