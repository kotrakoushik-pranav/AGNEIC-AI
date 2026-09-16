from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.detection import Detection


def get_all(
    db: Session,
    camera_id: Optional[int] = None,
    detection_type: Optional[str] = None,
    limit: int = 50,
) -> List[Detection]:
    q = db.query(Detection)
    if camera_id is not None:
        q = q.filter(Detection.camera_id == camera_id)
    if detection_type:
        q = q.filter(Detection.detection_type == detection_type)
    return q.order_by(Detection.detected_at.desc()).limit(limit).all()


def count_today(db: Session) -> int:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return db.query(Detection).filter(Detection.detected_at >= today_start).count()
