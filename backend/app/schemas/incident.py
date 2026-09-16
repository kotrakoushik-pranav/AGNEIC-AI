from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator

SeverityType = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
StatusType = Literal["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]


class IncidentCreate(BaseModel):
    incident_type: str
    severity: SeverityType
    confidence: float
    location: str
    description: Optional[str] = None
    camera_id: Optional[int] = None
    frame_data: Optional[str] = None
    detected_at: datetime

    @field_validator("confidence")
    @classmethod
    def confidence_in_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("confidence must be between 0.0 and 1.0")
        return v


class IncidentUpdate(BaseModel):
    status: Optional[StatusType] = None
    description: Optional[str] = None


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_type: str
    severity: str
    confidence: float
    camera_id: Optional[int] = None
    location: str
    status: str
    description: Optional[str] = None
    detected_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
