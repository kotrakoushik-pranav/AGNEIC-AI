"""
person.py — Database models for facial recognition.

Person        — a registered individual with a name.
FaceEmbedding — one or more 128-dim SFace embeddings per person.
RecognitionEvent — historical record of each real recognition result.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, LargeBinary
from sqlalchemy.sql import func

from app.database.session import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    reference_id = Column(String, nullable=True)   # optional external ID
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)
    # 128-float SFace embedding stored as raw bytes (numpy tobytes)
    embedding_bytes = Column(LargeBinary, nullable=False)
    # thumbnail (base64 JPEG crop) — optional, stored for review UI
    thumbnail_b64 = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RecognitionEvent(Base):
    __tablename__ = "recognition_events"

    id = Column(Integer, primary_key=True, index=True)
    # NULL → Unknown person
    person_id = Column(Integer, ForeignKey("persons.id", ondelete="SET NULL"), nullable=True, index=True)
    person_name = Column(String, nullable=False, default="Unknown")
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True, index=True)
    camera_name = Column(String, nullable=True)
    # cosine similarity (0–1); NULL for unknown
    similarity = Column(Float, nullable=True)
    # RECOGNIZED | UNKNOWN | VERIFYING
    result_status = Column(String, nullable=False, default="UNKNOWN")
    # bounding box JSON
    bounding_box = Column(String, nullable=True)
    # base64 face crop evidence
    face_crop_b64 = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
