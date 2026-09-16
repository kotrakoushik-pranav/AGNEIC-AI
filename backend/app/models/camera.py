from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func

from app.database.session import Base


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    # OFFLINE | CONNECTING | ONLINE | ERROR | PERMISSION_DENIED
    status = Column(String, nullable=False, default="OFFLINE")
    stream_url = Column(String, nullable=True)          # reserved for RTSP future
    is_monitoring = Column(Boolean, nullable=False, default=False)
    source_index = Column(Integer, nullable=True)       # browser device index
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
