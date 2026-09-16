from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CameraCreate(BaseModel):
    name: str
    location: str
    source_index: Optional[int] = 0   # browser device index


class CameraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    camera_code: str
    name: str
    location: str
    status: str
    stream_url: Optional[str] = None
    is_monitoring: bool
    source_index: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class CameraStatusUpdate(BaseModel):
    status: str
    is_monitoring: Optional[bool] = None
