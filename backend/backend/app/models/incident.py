from sqlalchemy import Column, Float, ForeignKey, Index, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from app.database.session import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    # face_detected | fire_detected | smoke_detected | fall | accident | suspicious
    incident_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)   # CRITICAL | HIGH | MEDIUM | LOW
    confidence = Column(Float, nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True)
    location = Column(String, nullable=False, default="Unknown")
    # ACTIVE | ACKNOWLEDGED | RESOLVED
    status = Column(String, nullable=False, default="ACTIVE")
    description = Column(String, nullable=True)
    # optional base64 evidence frame
    frame_data = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_severity", "severity"),
        Index("ix_incidents_detected_at", "detected_at"),
    )
