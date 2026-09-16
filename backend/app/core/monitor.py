"""
monitor.py — Monitoring session manager.

Handles:
- Receiving base64 frames from the frontend (browser camera)
- Running AI detection on those frames
- Storing detections and creating incidents
- Broadcasting real-time events via WebSocket
"""

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import numpy as np

from app.core.detector import run_all_detectors, DetectionResult
from app.core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)


def _severity_for_type(detection_type: str, confidence: float) -> str:
    if detection_type == "fire":
        return "CRITICAL" if confidence >= 0.80 else "HIGH"
    if detection_type == "smoke":
        return "HIGH" if confidence >= 0.75 else "MEDIUM"
    if detection_type == "face":
        return "LOW"
    if detection_type in ("accident", "fall"):
        return "CRITICAL" if confidence >= 0.80 else "HIGH"
    return "MEDIUM"


def _incident_type_label(detection_type: str) -> str:
    mapping = {
        "face":       "Face Detected",
        "fire":       "Fire Detected",
        "smoke":      "Smoke Detected",
        "fall":       "Fall Detected",
        "accident":   "Accident Detected",
        "suspicious": "Suspicious Activity",
    }
    return mapping.get(detection_type, detection_type.title())


def _decode_frame(b64_data: str) -> Optional[np.ndarray]:
    """Decode a base64 JPEG/PNG string into a numpy BGR frame."""
    try:
        # Strip data URI prefix if present
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = np.frombuffer(arr, dtype=np.uint8)
        import cv2
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.error("Frame decode error: %s", exc)
        return None


async def process_frame(
    camera_id: Optional[int],
    camera_location: str,
    frame_b64: str,
    enabled_detectors: list,
    db_session_factory,
) -> Dict[str, Any]:
    """
    Process one frame through the AI detectors and persist results.
    Returns summary of what was detected.

    REQUIRES camera_id — detections without a valid, ONLINE camera are rejected.
    """
    import cv2
    from app.models.detection import Detection
    from app.models.incident import Incident
    from app.models.alert import Alert
    from app.models.camera import Camera

    if camera_id is None:
        return {"error": "camera_id_required", "detections": []}

    frame = _decode_frame(frame_b64)
    if frame is None:
        return {"error": "invalid_frame"}

    results = run_all_detectors(frame, enabled=enabled_detectors)

    summary = {
        "detections": [],
        "incidents_created": [],
        "model_status": {},
    }

    db = db_session_factory()
    try:
        # Validate that the camera is genuinely ONLINE before persisting anything
        from app.models.camera import Camera as _CameraModel
        cam_row = db.query(_CameraModel).filter(_CameraModel.id == camera_id).first()
        if cam_row is None:
            return {"error": "camera_not_found", "detections": []}
        if cam_row.status not in ("ONLINE", "CONNECTED"):
            return {"skipped": True, "reason": f"camera_not_online (status={cam_row.status})", "detections": []}

        now = datetime.now(timezone.utc)

        for result in results:
            # Record model status
            summary["model_status"][result.detection_type] = result.model_status

            if result.confidence == 0.0:
                continue

            # Persist detection
            bb_json = json.dumps([b.to_dict() for b in result.bounding_boxes]) if result.bounding_boxes else None
            detection_row = Detection(
                camera_id=camera_id,
                detection_type=result.detection_type,
                confidence=result.confidence,
                bounding_box=bb_json,
                frame_data=result.frame_b64,
                detected_at=now,
            )
            db.add(detection_row)
            db.flush()

            detection_dict = {
                "id": detection_row.id,
                "camera_id": camera_id,
                "detection_type": result.detection_type,
                "confidence": result.confidence,
                "detected_at": now.isoformat(),
                "bounding_box": bb_json,
            }
            summary["detections"].append(detection_dict)

            # Broadcast detection event
            await ws_manager.broadcast_detection(detection_dict)

            # Create incident for significant detections (fire, smoke, accident, fall, suspicious)
            # For faces: only create incident if multiple faces or configured threshold
            should_create_incident = (
                result.detection_type in ("fire", "smoke", "accident", "fall", "suspicious")
                or (result.detection_type == "face" and result.confidence >= 0.70)
            )

            if should_create_incident:
                severity = _severity_for_type(result.detection_type, result.confidence)
                incident_type = _incident_type_label(result.detection_type)

                incident_row = Incident(
                    incident_type=incident_type,
                    severity=severity,
                    confidence=result.confidence,
                    camera_id=camera_id,
                    location=camera_location,
                    status="ACTIVE",
                    description=f"{incident_type} detected with {result.confidence:.0%} confidence.",
                    frame_data=result.frame_b64,
                    detected_at=now,
                )
                db.add(incident_row)
                db.flush()

                # Update detection FK
                detection_row.incident_id = incident_row.id

                # Create alert
                alert_row = Alert(
                    incident_id=incident_row.id,
                    alert_type=result.detection_type.upper(),
                    recipient="dashboard",
                    severity=severity,
                    status="ACTIVE",
                )
                db.add(alert_row)
                db.flush()

                db.commit()
                db.refresh(incident_row)
                db.refresh(alert_row)

                incident_dict = {
                    "id": incident_row.id,
                    "incident_type": incident_row.incident_type,
                    "severity": severity,
                    "confidence": result.confidence,
                    "camera_id": camera_id,
                    "location": camera_location,
                    "status": "ACTIVE",
                    "detected_at": now.isoformat(),
                }
                alert_dict = {
                    "id": alert_row.id,
                    "incident_id": incident_row.id,
                    "alert_type": alert_row.alert_type,
                    "severity": severity,
                    "status": "ACTIVE",
                }

                summary["incidents_created"].append(incident_dict)

                await ws_manager.broadcast_incident(incident_dict)
                await ws_manager.broadcast_alert(alert_dict)

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("process_frame DB error: %s", exc)
        summary["error"] = str(exc)
    finally:
        db.close()

    return summary
