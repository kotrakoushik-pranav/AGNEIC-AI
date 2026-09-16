from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.session import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    alert_type = Column(String, nullable=False)
    recipient = Column(String, nullable=False, default="dashboard")
    severity = Column(String, nullable=False, default="MEDIUM")
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
