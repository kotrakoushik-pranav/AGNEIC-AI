from sqlalchemy import Column, Float, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from app.database.session import Base


class Detection(Base):
    """Raw AI detection event. One detection may create one Incident."""
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True, index=True)
    # face | fire | smoke | fall | accident | suspicious
    detection_type = Column(String, nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    # bounding box (optional) stored as JSON string
    bounding_box = Column(String, nullable=True)
    # base64 evidence frame (optional)
    frame_data = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # FK to incident if one was created from this detection
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
