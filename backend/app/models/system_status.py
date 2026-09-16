from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.session import Base


class SystemStatus(Base):
    __tablename__ = "system_status"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, nullable=False)
    last_updated = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
