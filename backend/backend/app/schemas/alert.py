from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    alert_type: str
    recipient: str
    status: str
    severity: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
