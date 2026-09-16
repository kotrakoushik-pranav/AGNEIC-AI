from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.camera import Camera
import re


def _next_camera_code(db: Session) -> str:
    """Generate next CAM-XX code."""
    rows = db.query(Camera.camera_code).all()
    nums = []
    for (code,) in rows:
        m = re.match(r"CAM-(\d+)", code or "")
        if m:
            nums.append(int(m.group(1)))
    next_num = (max(nums) + 1) if nums else 1
    return f"CAM-{next_num:02d}"


def get_all(db: Session) -> List[Camera]:
    return db.query(Camera).all()


def get_by_id(db: Session, camera_id: int) -> Optional[Camera]:
    return db.query(Camera).filter(Camera.id == camera_id).first()


def create(db: Session, data) -> Camera:
    from app.schemas.camera import CameraCreate
    code = _next_camera_code(db)
    camera = Camera(
        camera_code=code,
        name=data.name,
        location=data.location,
        status="OFFLINE",
        source_index=data.source_index,
        is_monitoring=False,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


def delete(db: Session, camera_id: int) -> bool:
    camera = get_by_id(db, camera_id)
    if camera is None:
        return False
    db.delete(camera)
    db.commit()
    return True


def update_status(
    db: Session,
    camera_id: int,
    status: str,
    is_monitoring: Optional[bool] = None,
) -> Optional[Camera]:
    camera = get_by_id(db, camera_id)
    if camera is None:
        return None
    camera.status = status
    if is_monitoring is not None:
        camera.is_monitoring = is_monitoring
    db.commit()
    db.refresh(camera)
    return camera
