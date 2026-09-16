from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DetectionCreate(BaseModel):
    camera_id: Optional[int] = None
    detection_type: str
    confidence: float
    bounding_box: Optional[str] = None
    frame_data: Optional[str] = None
    detected_at: datetime


class DetectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    camera_id: Optional[int] = None
    detection_type: str
    confidence: float
    bounding_box: Optional[str] = None
    detected_at: datetime
    created_at: datetime
    incident_id: Optional[int] = None
