from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SystemStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_name: str
    status: str
    last_updated: datetime
