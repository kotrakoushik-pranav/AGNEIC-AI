"""
seed.py — Aegis AI database seed script.

Run from the backend/ directory:
    python seed.py

Requirements:
- Loads DATABASE_URL from .env in backend/
- Creates all tables if they don't exist
- Inserts seed data idempotently (safe to run multiple times)

Environment variables:
  DEMO_MODE=true   — also inserts simulated incidents and alerts for UI demonstration.
                     Default is false (clean state: cameras OFFLINE, no fake incidents).
"""

import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Load .env from current directory (backend/)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set.")
    print("Copy .env.example to .env and fill in your database credentials.")
    sys.exit(1)

# DEMO_MODE=true enables simulated incidents/alerts for UI demonstration
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() in ("true", "1", "yes")

# Import Base and all models so metadata is populated
from app.database.session import Base
from app.models.camera import Camera
from app.models.incident import Incident
from app.models.alert import Alert
from app.models.system_status import SystemStatus

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def seed():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables ready.")
    if DEMO_MODE:
        print("DEMO_MODE=true — inserting simulated incidents and alerts.")
    else:
        print("DEMO_MODE=false — inserting cameras as OFFLINE, no simulated incidents.")

    db = SessionLocal()
    try:
        # ── Cameras ──────────────────────────────────────────────────────
        # Cameras always start OFFLINE. Only a real connected worker sets ONLINE.
        camera_data = [
            {"camera_code": "CAM-01", "name": "Main Entrance",        "location": "Main Entrance",        "status": "OFFLINE"},
            {"camera_code": "CAM-02", "name": "Parking Area",         "location": "Parking Area",         "status": "OFFLINE"},
            {"camera_code": "CAM-03", "name": "Building A Corridor",  "location": "Building A Corridor",  "status": "OFFLINE"},
            {"camera_code": "CAM-04", "name": "Restricted Zone",      "location": "Restricted Zone",      "status": "OFFLINE"},
        ]
        cam_map = {}
        for cd in camera_data:
            existing = db.query(Camera).filter_by(camera_code=cd["camera_code"]).first()
            if not existing:
                cam = Camera(**cd)
                db.add(cam)
                db.flush()
                cam_map[cd["camera_code"]] = cam
                print(f"  Inserted camera: {cd['camera_code']} (OFFLINE)")
            else:
                cam_map[cd["camera_code"]] = existing
                print(f"  Camera exists:   {cd['camera_code']}")
        db.commit()

        # ── DEMO incidents & alerts (only when DEMO_MODE=true) ────────────
        if DEMO_MODE:
            now = datetime.now(timezone.utc)
            incident_data = [
                {
                    "incident_type": "Accident",
                    "severity": "CRITICAL",
                    "confidence": 0.94,
                    "camera_id": cam_map["CAM-02"].id,
                    "location": "Parking Area",
                    "status": "ACTIVE",
                    "description": "[DEMO] Possible vehicle accident detected in parking area",
                    "detected_at": now - timedelta(minutes=18),
                },
                {
                    "incident_type": "Restricted Area Entry",
                    "severity": "HIGH",
                    "confidence": 0.91,
                    "camera_id": cam_map["CAM-04"].id,
                    "location": "Building A",
                    "status": "ACTIVE",
                    "description": "[DEMO] Unauthorized entry detected in restricted zone",
                    "detected_at": now - timedelta(minutes=12),
                },
                {
                    "incident_type": "Crowd Density Warning",
                    "severity": "MEDIUM",
                    "confidence": 0.87,
                    "camera_id": cam_map["CAM-01"].id,
                    "location": "Main Entrance",
                    "status": "ACTIVE",
                    "description": "[DEMO] High crowd density at main entrance",
                    "detected_at": now - timedelta(minutes=5),
                },
            ]
            incident_map = {}
            for idx, id_data in enumerate(incident_data):
                existing = db.query(Incident).filter_by(
                    incident_type=id_data["incident_type"],
                    location=id_data["location"],
                    status="ACTIVE",
                ).first()
                if not existing:
                    incident = Incident(**id_data)
                    db.add(incident)
                    db.flush()
                    incident_map[idx] = incident
                    print(f"  [DEMO] Inserted incident: {id_data['incident_type']} ({id_data['severity']})")
                else:
                    incident_map[idx] = existing
                    print(f"  [DEMO] Incident exists:   {id_data['incident_type']}")
            db.commit()

            # Alert linked to CRITICAL demo incident
            critical_incident = incident_map.get(0)
            if critical_incident:
                existing_alert = db.query(Alert).filter_by(incident_id=critical_incident.id).first()
                if not existing_alert:
                    alert = Alert(
                        incident_id=critical_incident.id,
                        alert_type="SECURITY_RESPONSE",
                        recipient="security_team@facility.local",
                        status="SENT",
                        severity="CRITICAL",
                    )
                    db.add(alert)
                    db.commit()
                    print("  [DEMO] Inserted alert for CRITICAL incident")
                else:
                    print("  [DEMO] Alert exists for CRITICAL incident")

        # ── System Status ─────────────────────────────────────────────────
        services = [
            {"service_name": "AI Engine",         "status": "ONLINE"},
            {"service_name": "Video Processing",  "status": "ONLINE"},
            {"service_name": "Backend",           "status": "ONLINE"},
            {"service_name": "Database",          "status": "ONLINE"},
            {"service_name": "Alert Service",     "status": "ONLINE"},
            {"service_name": "Camera Network",    "status": "ONLINE"},
        ]
        for svc in services:
            existing = db.query(SystemStatus).filter_by(service_name=svc["service_name"]).first()
            if not existing:
                db.add(SystemStatus(**svc))
                print(f"  Inserted service: {svc['service_name']}")
            else:
                print(f"  Service exists:   {svc['service_name']}")
        db.commit()

        print("\n✓ Seed complete.")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Seed failed: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
