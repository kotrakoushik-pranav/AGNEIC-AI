"""
camera_adapters.py — Unified camera ingestion layer.

Architecture:
  CameraAdapter (abstract base)
    ├── RTSPCameraAdapter    — IP/CCTV cameras via RTSP or HTTP-MJPEG (OpenCV)
    ├── USBCameraAdapter     — USB / built-in webcams (OpenCV device index)
    ├── WebRTCCameraAdapter  — Browser webcams / mobile (frames pushed via API)
    ├── MobileCameraAdapter  — Subclass of WebRTC with mobile label
    └── DroneCameraAdapter   — Pluggable interface; RTSP-backed or subclass

Each adapter implements:
  validate_connection() → (bool, str)   test without persisting
  open_stream()         → bool
  read_frame()          → Optional[np.ndarray]
  close_stream()
  get_info()            → dict

CameraWorker  — per-camera async task: opens stream, reads frames, runs AI,
                monitors health, handles reconnection with exponential backoff.

CameraManager — singleton that orchestrates all workers.
"""

import abc
import asyncio
import base64
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────

CAMERA_TIMEOUT = int(os.getenv("CAMERA_TIMEOUT", "10"))
RECONNECT_INTERVAL = float(os.getenv("RECONNECT_INTERVAL", "5"))
MAX_RECONNECT_ATTEMPTS = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))
PROCESS_EVERY_N = int(os.getenv("CAMERA_PROCESS_EVERY_N", "3"))
FRAME_STALL_TIMEOUT = float(os.getenv("FRAME_STALL_TIMEOUT", "10.0"))


# ─── Abstract base ───────────────────────────────────────────────────────────

class CameraAdapter(abc.ABC):
    """Abstract camera adapter. All concrete adapters must implement this."""

    adapter_type: str = "base"

    def __init__(self, camera_id: int, config: dict):
        self.camera_id = camera_id
        self.config = config
        self._fps: float = 0.0
        self._resolution: tuple = (0, 0)
        self._last_frame_time: float = 0.0

    @abc.abstractmethod
    def validate_connection(self) -> tuple:
        """(success: bool, message: str) — test without starting persistent stream."""

    @abc.abstractmethod
    def open_stream(self) -> bool:
        """Open the stream. Return True on success."""

    @abc.abstractmethod
    def read_frame(self) -> Optional[np.ndarray]:
        """Return next frame or None on failure."""

    @abc.abstractmethod
    def close_stream(self):
        """Close stream and release resources."""

    def get_info(self) -> dict:
        w, h = self._resolution
        return {
            "adapter_type": self.adapter_type,
            "fps": round(self._fps, 1),
            "resolution": f"{w}x{h}" if h > 0 else "unknown",
            "last_frame_time": self._last_frame_time,
        }


# ─── RTSP / IP Camera ────────────────────────────────────────────────────────

class RTSPCameraAdapter(CameraAdapter):
    """
    IP cameras and CCTV via RTSP or HTTP-MJPEG (OpenCV VideoCapture).

    config keys:
      stream_url: str  — e.g. rtsp://user:pass@192.168.1.100:554/stream
    """
    adapter_type = "rtsp"

    def __init__(self, camera_id: int, config: dict):
        super().__init__(camera_id, config)
        self._cap: Optional[cv2.VideoCapture] = None
        self._stream_url: str = config.get("stream_url", "")

    def _safe_url_for_log(self) -> str:
        """Hide credentials from log output."""
        url = self._stream_url
        if "@" in url:
            scheme_end = url.find("://") + 3
            at_pos = url.rfind("@")
            return url[:scheme_end] + "***@" + url[at_pos + 1:]
        return url

    def validate_connection(self) -> tuple:
        if not self._stream_url:
            return False, "No stream_url provided"
        try:
            cap = cv2.VideoCapture(self._stream_url)
            if not cap.isOpened():
                cap.release()
                return False, f"Cannot open: {self._safe_url_for_log()}"
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return False, "Stream opened but no frames received"
            h, w = frame.shape[:2]
            return True, f"OK — {w}x{h}"
        except Exception as exc:
            return False, f"Connection error: {exc}"

    def open_stream(self) -> bool:
        try:
            self._cap = cv2.VideoCapture(self._stream_url)
            if not self._cap.isOpened():
                return False
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            fps = self._cap.get(cv2.CAP_PROP_FPS)
            if fps > 0:
                self._fps = fps
            w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self._resolution = (w, h)
            return True
        except Exception as exc:
            logger.error("RTSPAdapter open_stream: %s", exc)
            return False

    def read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None or not self._cap.isOpened():
            return None
        ret, frame = self._cap.read()
        if ret and frame is not None:
            self._last_frame_time = time.monotonic()
            return frame
        return None

    def close_stream(self):
        if self._cap:
            self._cap.release()
            self._cap = None


# ─── USB / Built-in Webcam ───────────────────────────────────────────────────

class USBCameraAdapter(CameraAdapter):
    """
    USB webcams and built-in laptop cameras (OpenCV device index).

    config keys:
      device_index: int  — 0 = first webcam, 1 = second, etc.
    """
    adapter_type = "usb"

    def __init__(self, camera_id: int, config: dict):
        super().__init__(camera_id, config)
        self._cap: Optional[cv2.VideoCapture] = None
        self._device_index: int = int(config.get("device_index", 0))

    def validate_connection(self) -> tuple:
        try:
            cap = cv2.VideoCapture(self._device_index)
            if not cap.isOpened():
                cap.release()
                return False, f"Cannot open device index {self._device_index}"
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return False, f"Device {self._device_index} opened but no frames"
            h, w = frame.shape[:2]
            return True, f"USB camera {self._device_index} OK — {w}x{h}"
        except Exception as exc:
            return False, f"USB error: {exc}"

    def open_stream(self) -> bool:
        try:
            self._cap = cv2.VideoCapture(self._device_index)
            if not self._cap.isOpened():
                return False
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            fps = self._cap.get(cv2.CAP_PROP_FPS)
            if fps > 0:
                self._fps = fps
            w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self._resolution = (w, h)
            return True
        except Exception as exc:
            logger.error("USBAdapter open_stream: %s", exc)
            return False

    def read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None or not self._cap.isOpened():
            return None
        ret, frame = self._cap.read()
        if ret and frame is not None:
            self._last_frame_time = time.monotonic()
            return frame
        return None

    def close_stream(self):
        if self._cap:
            self._cap.release()
            self._cap = None


# ─── WebRTC / Browser Push ───────────────────────────────────────────────────

class WebRTCCameraAdapter(CameraAdapter):
    """
    Push-based adapter: browser/mobile pushes base64 frames via
    POST /api/cameras/{id}/frame.

    The adapter buffers the latest received frame for the worker to read.
    Validation is immediate — actual liveness confirmed when first frame arrives.

    config keys:
      label: str  — display label (optional)
    """
    adapter_type = "webrtc"

    def __init__(self, camera_id: int, config: dict):
        super().__init__(camera_id, config)
        self._latest_frame: Optional[np.ndarray] = None
        self._connected = False
        self._fps_counter = 0
        self._fps_timer = time.monotonic()

    def validate_connection(self) -> tuple:
        return True, "Push-based camera ready. Start streaming from device."

    def open_stream(self) -> bool:
        self._connected = True
        return True

    def read_frame(self) -> Optional[np.ndarray]:
        frame = self._latest_frame
        if frame is not None:
            self._last_frame_time = time.monotonic()
        return frame

    def push_frame(self, frame_b64: str) -> bool:
        """Called by the API when the browser sends a frame."""
        try:
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(frame_b64)
            arr = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                return False
            self._latest_frame = frame
            self._last_frame_time = time.monotonic()
            if self._resolution == (0, 0):
                h, w = frame.shape[:2]
                self._resolution = (w, h)
            # FPS
            self._fps_counter += 1
            now = time.monotonic()
            elapsed = now - self._fps_timer
            if elapsed >= 1.0:
                self._fps = self._fps_counter / elapsed
                self._fps_counter = 0
                self._fps_timer = now
            return True
        except Exception as exc:
            logger.error("WebRTCAdapter push_frame: %s", exc)
            return False

    def close_stream(self):
        self._connected = False
        self._latest_frame = None


# ─── Mobile Camera ────────────────────────────────────────────────────────────

class MobileCameraAdapter(WebRTCCameraAdapter):
    """
    Mobile phone cameras connected over LAN via browser.
    Functionally identical to WebRTCCameraAdapter.

    Future WAN support: add TURN server config here.
    """
    adapter_type = "mobile"


# ─── Drone Camera ─────────────────────────────────────────────────────────────

class DroneCameraAdapter(CameraAdapter):
    """
    Pluggable drone camera adapter.

    Currently: if stream_url is provided, delegates to RTSPCameraAdapter.
    To add vendor-specific support (DJI, Parrot, etc.):
      1. Subclass DroneCameraAdapter
      2. Override validate_connection, open_stream, read_frame, close_stream
      3. Register in ADAPTER_REGISTRY

    Supported stream types:
      - RTSP from drone ground station (via stream_url)
      - UDP streams (future: via stream_url udp://...)
      - WebRTC relay (future: use MobileCameraAdapter approach)
      - HDMI capture card (future: use USBCameraAdapter with capture device index)
    """
    adapter_type = "drone"

    def __init__(self, camera_id: int, config: dict):
        super().__init__(camera_id, config)
        self._delegate: Optional[CameraAdapter] = None
        stream_url = config.get("stream_url", "")
        if stream_url:
            self._delegate = RTSPCameraAdapter(camera_id, config)

    def validate_connection(self) -> tuple:
        if self._delegate:
            return self._delegate.validate_connection()
        return (
            False,
            "No drone stream configured. Provide stream_url or implement a "
            "vendor-specific DroneCameraAdapter subclass.",
        )

    def open_stream(self) -> bool:
        if self._delegate:
            result = self._delegate.open_stream()
            if result:
                self._fps = self._delegate._fps
                self._resolution = self._delegate._resolution
            return result
        raise NotImplementedError(
            "DroneCameraAdapter requires stream_url or a vendor-specific subclass."
        )

    def read_frame(self) -> Optional[np.ndarray]:
        if self._delegate:
            frame = self._delegate.read_frame()
            if frame is not None:
                self._last_frame_time = time.monotonic()
            return frame
        return None

    def close_stream(self):
        if self._delegate:
            self._delegate.close_stream()


# ─── Adapter Registry ────────────────────────────────────────────────────────

ADAPTER_REGISTRY: Dict[str, type] = {
    "rtsp":          RTSPCameraAdapter,
    "ip_camera":     RTSPCameraAdapter,
    "cctv":          RTSPCameraAdapter,
    "http_mjpeg":    RTSPCameraAdapter,
    "usb":           USBCameraAdapter,
    "webcam":        USBCameraAdapter,
    "laptop_webcam": USBCameraAdapter,
    "webrtc":        WebRTCCameraAdapter,
    "browser":       WebRTCCameraAdapter,
    "mobile":        MobileCameraAdapter,
    "phone":         MobileCameraAdapter,
    "drone":         DroneCameraAdapter,
}


def create_adapter(camera_id: int, adapter_type: str, config: dict) -> CameraAdapter:
    """Factory: create the correct adapter for a given type string."""
    cls = ADAPTER_REGISTRY.get(adapter_type.lower())
    if cls is None:
        valid = list(ADAPTER_REGISTRY.keys())
        raise ValueError(f"Unknown adapter_type '{adapter_type}'. Valid: {valid}")
    return cls(camera_id, config)


# ─── Camera Health ────────────────────────────────────────────────────────────

@dataclass
class CameraHealthState:
    camera_id: int
    status: str = "OFFLINE"
    error_reason: Optional[str] = None
    fps: float = 0.0
    resolution: str = "unknown"
    last_frame_at: Optional[float] = None
    dropped_frames: int = 0
    reconnect_count: int = 0
    ai_processing: bool = False
    people_detected: int = 0
    faces_recognized: int = 0
    frame_count: int = 0
    worker_id: Optional[str] = None


# ─── Camera Worker ────────────────────────────────────────────────────────────

class CameraWorker:
    """
    Per-camera async worker.

    Pull-based (RTSP, USB): reads frames in a tight loop.
    Push-based (WebRTC, Mobile): polls adapter buffer for new frames.

    Handles reconnection with exponential backoff.
    Each camera worker is fully isolated — one crash cannot affect others.
    """

    def __init__(
        self,
        camera_id: int,
        adapter: CameraAdapter,
        db_session_factory,
        ws_manager,
        health: CameraHealthState,
        enabled_detectors: List[str] = None,
    ):
        self.camera_id = camera_id
        self.adapter = adapter
        self.db_session_factory = db_session_factory
        self.ws_manager = ws_manager
        self.health = health
        self.enabled_detectors = enabled_detectors or ["face", "fire", "smoke"]
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._frame_counter = 0

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(
            self._run(), name=f"cam_worker_{self.camera_id}"
        )
        self.health.worker_id = self._task.get_name()

    async def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await asyncio.wait_for(self._task, timeout=3.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        try:
            self.adapter.close_stream()
        except Exception:
            pass
        self.health.status = "OFFLINE"
        self.health.ai_processing = False

    async def _broadcast_status(self, status: str, **extra):
        await self.ws_manager.broadcast(
            "camera_status",
            {"camera_id": self.camera_id, "status": status, **extra},
        )

    async def _update_db(self, status: str, is_monitoring: bool = False):
        try:
            from app.services import camera_service
            db = self.db_session_factory()
            try:
                camera_service.update_status(db, self.camera_id, status, is_monitoring)
            finally:
                db.close()
        except Exception as exc:
            logger.error("Camera %s DB update error: %s", self.camera_id, exc)

    async def _run(self):
        reconnect_attempt = 0

        while self._running:
            # ── CONNECTING ───────────────────────────────────────────────────
            self.health.status = "CONNECTING"
            self.health.error_reason = None
            await self._update_db("CONNECTING", False)
            await self._broadcast_status("CONNECTING", is_monitoring=False)

            opened = False
            try:
                opened = await asyncio.get_event_loop().run_in_executor(
                    None, self.adapter.open_stream
                )
            except NotImplementedError as exc:
                self.health.error_reason = str(exc)
                logger.error("Camera %s: %s", self.camera_id, exc)
                self._running = False
                break
            except Exception as exc:
                self.health.error_reason = str(exc)
                logger.error("Camera %s open_stream error: %s", self.camera_id, exc)

            if not opened:
                reason = self.health.error_reason or "Failed to open stream"
                self.health.status = "ERROR"
                await self._update_db("ERROR", False)
                await self._broadcast_status("ERROR", error=reason, is_monitoring=False)
                logger.error("Camera %s error: %s", self.camera_id, reason)

                if reconnect_attempt >= MAX_RECONNECT_ATTEMPTS:
                    self.health.status = "OFFLINE"
                    await self._update_db("OFFLINE", False)
                    await self._broadcast_status("OFFLINE", is_monitoring=False)
                    break

                delay = min(RECONNECT_INTERVAL * (2 ** reconnect_attempt), 60)
                reconnect_attempt += 1
                logger.info(
                    "Camera %s reconnecting in %.1fs (attempt %d/%d)",
                    self.camera_id, delay, reconnect_attempt, MAX_RECONNECT_ATTEMPTS,
                )
                await asyncio.sleep(delay)
                continue

            # ── ONLINE ───────────────────────────────────────────────────────
            self.health.status = "ONLINE"
            self.health.ai_processing = True
            reconnect_attempt = 0
            await self._update_db("ONLINE", True)
            await self._broadcast_status("ONLINE", is_monitoring=True)
            logger.info("Camera %s ONLINE (adapter: %s)", self.camera_id, self.adapter.adapter_type)

            fps_counter = 0
            fps_timer = time.monotonic()
            stall_timer = time.monotonic()
            last_frame_hash: Optional[int] = None  # detect stale push frames

            # ── FRAME LOOP ───────────────────────────────────────────────────
            while self._running:
                try:
                    frame = await asyncio.get_event_loop().run_in_executor(
                        None, self.adapter.read_frame
                    )
                except Exception as exc:
                    logger.error("Camera %s read_frame: %s", self.camera_id, exc)
                    frame = None

                if frame is None:
                    if time.monotonic() - stall_timer > FRAME_STALL_TIMEOUT:
                        logger.warning(
                            "Camera %s stalled (no frames for %.0fs)",
                            self.camera_id, FRAME_STALL_TIMEOUT,
                        )
                        self.health.dropped_frames += 1
                        break  # trigger reconnect
                    await asyncio.sleep(0.033)
                    continue

                # For push-based adapters, detect if we're seeing the same frame repeatedly
                if isinstance(self.adapter, WebRTCCameraAdapter):
                    frame_id = id(frame)
                    if frame_id == last_frame_hash:
                        # Same frame object — no new data yet
                        if time.monotonic() - stall_timer > FRAME_STALL_TIMEOUT:
                            logger.warning("Camera %s push stream stalled", self.camera_id)
                            break
                        await asyncio.sleep(0.033)
                        continue
                    last_frame_hash = frame_id
                    stall_timer = time.monotonic()
                else:
                    stall_timer = time.monotonic()

                self.health.last_frame_at = time.monotonic()
                self.health.frame_count += 1

                # FPS
                fps_counter += 1
                now = time.monotonic()
                elapsed = now - fps_timer
                if elapsed >= 1.0:
                    self.health.fps = fps_counter / elapsed
                    fps_counter = 0
                    fps_timer = now
                    info = self.adapter.get_info()
                    self.health.resolution = info.get("resolution", "unknown")

                # AI (every N frames)
                self._frame_counter += 1
                if self._frame_counter % PROCESS_EVERY_N == 0:
                    asyncio.create_task(self._process_frame(frame))

                await asyncio.sleep(0)

            # Stream ended
            if self._running:
                self.health.status = "RECONNECTING"
                self.health.reconnect_count += 1
                await self._update_db("RECONNECTING", False)
                await self._broadcast_status(
                    "RECONNECTING",
                    reconnect_count=self.health.reconnect_count,
                    is_monitoring=False,
                )
                try:
                    self.adapter.close_stream()
                except Exception:
                    pass
                delay = min(RECONNECT_INTERVAL * (2 ** reconnect_attempt), 60)
                reconnect_attempt += 1
                logger.info("Camera %s reconnecting in %.1fs", self.camera_id, delay)
                await asyncio.sleep(delay)

        # Final cleanup
        try:
            self.adapter.close_stream()
        except Exception:
            pass
        self.health.status = "OFFLINE"
        self.health.ai_processing = False
        await self._update_db("OFFLINE", False)
        await self._broadcast_status("OFFLINE", is_monitoring=False)
        logger.info("Camera %s worker stopped", self.camera_id)

    async def _process_frame(self, frame: np.ndarray):
        """Run AI pipeline on one frame (fire-and-forget task)."""
        from app.core.monitor import process_frame

        try:
            db = self.db_session_factory()
            location = "Unknown"
            try:
                from app.models.camera import Camera as CameraModel
                row = db.query(CameraModel).filter(
                    CameraModel.id == self.camera_id
                ).first()
                if row:
                    location = row.location
            finally:
                db.close()

            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if not ok:
                return
            frame_b64 = base64.b64encode(buf.tobytes()).decode()

            result = await process_frame(
                camera_id=self.camera_id,
                camera_location=location,
                frame_b64=frame_b64,
                enabled_detectors=self.enabled_detectors,
                db_session_factory=self.db_session_factory,
            )

            detections = result.get("detections", [])
            self.health.people_detected = sum(
                1 for d in detections if d.get("detection_type") == "face"
            )

        except Exception as exc:
            logger.error("Camera %s AI error: %s", self.camera_id, exc)


# ─── Camera Manager (Singleton) ──────────────────────────────────────────────

class CameraManager:
    """Singleton that manages all active camera workers."""

    def __init__(self):
        self._workers: Dict[int, CameraWorker] = {}
        self._adapters: Dict[int, CameraAdapter] = {}
        self._health: Dict[int, CameraHealthState] = {}

    async def start_camera(
        self,
        camera_id: int,
        adapter_type: str,
        config: dict,
        db_session_factory,
        ws_manager,
        enabled_detectors: List[str] = None,
    ) -> tuple:
        """Start a camera worker. Returns (success: bool, message: str)."""
        if camera_id in self._workers:
            h = self._workers[camera_id].health
            if h.status in ("ONLINE", "CONNECTING"):
                return False, f"Camera {camera_id} already running ({h.status})"
            await self.stop_camera(camera_id)

        try:
            adapter = create_adapter(camera_id, adapter_type, config)
        except ValueError as exc:
            return False, str(exc)

        health = CameraHealthState(camera_id=camera_id)
        self._adapters[camera_id] = adapter
        self._health[camera_id] = health

        worker = CameraWorker(
            camera_id=camera_id,
            adapter=adapter,
            db_session_factory=db_session_factory,
            ws_manager=ws_manager,
            health=health,
            enabled_detectors=enabled_detectors,
        )
        self._workers[camera_id] = worker
        await worker.start()
        return True, f"Camera {camera_id} worker started ({adapter_type})"

    async def stop_camera(self, camera_id: int) -> tuple:
        worker = self._workers.pop(camera_id, None)
        if worker is None:
            return False, f"Camera {camera_id} not running"
        await worker.stop()
        self._adapters.pop(camera_id, None)
        return True, f"Camera {camera_id} stopped"

    def push_frame(self, camera_id: int, frame_b64: str) -> tuple:
        """Push a frame to a WebRTC/Mobile adapter."""
        adapter = self._adapters.get(camera_id)
        if adapter is None:
            return False, f"Camera {camera_id} not registered"
        if not isinstance(adapter, WebRTCCameraAdapter):
            return (
                False,
                f"Camera {camera_id} adapter '{adapter.adapter_type}' "
                "is not push-based. Use RTSP/USB for pull-based cameras.",
            )
        ok = adapter.push_frame(frame_b64)
        return ok, "Frame received" if ok else "Frame decode failed"

    def get_latest_frame(self, camera_id: int) -> Optional[bytes]:
        """
        Return the latest raw JPEG bytes from the camera worker.

        For WebRTC/Mobile adapters the latest numpy frame is re-encoded to JPEG.
        For RTSP/USB adapters the latest frame captured by the worker is used.
        Returns None if no frame is available.
        """
        adapter = self._adapters.get(camera_id)
        if adapter is None:
            return None

        if isinstance(adapter, WebRTCCameraAdapter):
            frame = adapter._latest_frame
            if frame is None:
                return None
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                return None
            return buf.tobytes()

        # For pull-based adapters (RTSP, USB) grab the stored health frame.
        # We re-read from the adapter's last known frame if possible.
        health = self._health.get(camera_id)
        if health is None or health.last_frame_at is None:
            return None
        # Fall back to reading a frame directly from the adapter (non-blocking)
        try:
            frame = adapter.read_frame()
            if frame is None:
                return None
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                return None
            return buf.tobytes()
        except Exception:
            return None

    def get_health(self, camera_id: int) -> Optional[CameraHealthState]:
        return self._health.get(camera_id)

    def get_all_health(self) -> Dict[int, dict]:
        result = {}
        for cid, h in self._health.items():
            result[cid] = {
                "camera_id": cid,
                "status": h.status,
                "error_reason": h.error_reason,
                "fps": round(h.fps, 1),
                "resolution": h.resolution,
                "last_frame_at": h.last_frame_at,
                "dropped_frames": h.dropped_frames,
                "reconnect_count": h.reconnect_count,
                "ai_processing": h.ai_processing,
                "people_detected": h.people_detected,
                "faces_recognized": h.faces_recognized,
                "frame_count": h.frame_count,
                "worker_id": h.worker_id,
            }
        return result

    def test_connection(self, adapter_type: str, config: dict) -> tuple:
        """Test without starting a persistent stream."""
        try:
            adapter = create_adapter(-1, adapter_type, config)
            return adapter.validate_connection()
        except ValueError as exc:
            return False, str(exc)
        except Exception as exc:
            return False, f"Test failed: {exc}"

    def is_running(self, camera_id: int) -> bool:
        return camera_id in self._workers

    def list_active(self) -> List[int]:
        return list(self._workers.keys())

    async def shutdown_all(self):
        """Stop all workers gracefully (called on app shutdown)."""
        camera_ids = list(self._workers.keys())
        for cid in camera_ids:
            try:
                await self.stop_camera(cid)
            except Exception as exc:
                logger.error("Error stopping camera %s: %s", cid, exc)
        logger.info("CameraManager: all workers stopped")


# Singleton
camera_manager = CameraManager()
