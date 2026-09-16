import logging
import os as _os
from contextlib import asynccontextmanager
from pathlib import Path as _Path
from typing import AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.database.session import engine, Base

# ── Routers ──────────────────────────────────────────────────────────────────
from app.api import cameras, incidents, alerts, system, dashboard, detections
from app.api import recognition as recognition_router
from app.api import monitoring
from app.api import mobile as mobile_router

logger = logging.getLogger(__name__)

# Static files directory (backend/app/static/)
_STATIC = _Path(__file__).parent / "static"
_STATIC.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: create DB tables + load AI models. Shutdown: stop all camera workers."""

    # ── DB tables ─────────────────────────────────────────────────────────
    logger.info("Starting up Aegis AI API — creating database tables…")
    try:
        import app.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready.")
    except Exception as exc:
        logger.error("Database startup error: %s — check DATABASE_URL in .env", exc)

    # ── Reconcile camera statuses on startup ──────────────────────────────
    # Any camera that was ONLINE/CONNECTING before a server crash is now
    # unreachable — mark them OFFLINE so the dashboard shows the truth.
    try:
        from app.database.session import SessionLocal as _SL
        from app.models.camera import Camera as _Cam
        _db = _SL()
        stale = _db.query(_Cam).filter(
            _Cam.status.in_(["ONLINE", "CONNECTING", "RECONNECTING"])
        ).all()
        for cam in stale:
            cam.status = "OFFLINE"
            cam.is_monitoring = False
        _db.commit()
        if stale:
            logger.info("Startup: reset %d stale camera(s) from ONLINE→OFFLINE", len(stale))
        _db.close()
    except Exception as exc:
        logger.error("Startup camera reconciliation error: %s", exc)

    # ── Face recognition models (background thread) ───────────────────────
    import asyncio
    import concurrent.futures
    from app.core.face_engine import face_engine

    async def _load_models():
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            await loop.run_in_executor(pool, face_engine.load_models)

    asyncio.create_task(_load_models())
    logger.info("Face recognition model loading initiated in background.")

    yield  # ── application running ─────────────────────────────────────

    # ── Shutdown ──────────────────────────────────────────────────────────
    logger.info("Shutting down — stopping all camera workers…")
    from app.core.camera_adapters import camera_manager
    await camera_manager.shutdown_all()
    logger.info("Aegis AI API shut down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Aegis AI API",
    description="Smart Safety — multi-camera AI surveillance platform.",
    version="3.1.0",
    lifespan=lifespan,
)

# ── CORS — wide open in dev so phone browser works ───────────────────────────
# When ENVIRONMENT=development, allow all origins (needed for phone access).
# allow_credentials must be False when allow_origins=["*"].
_cors_origins = ["*"] if settings.environment == "development" else settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Mobile camera page (served at /mobile-camera) ────────────────────────────

@app.get("/mobile-camera", include_in_schema=False)
def mobile_camera_page():
    """Serves the mobile camera HTML page for phones."""
    html = _STATIC / "mobile-camera.html"
    if not html.exists():
        return HTMLResponse("<h1>Mobile camera page not found</h1>", status_code=404)
    return FileResponse(str(html))


@app.get("/camera-client", include_in_schema=False)
def camera_client_page():
    """Second laptop / computer as camera client — reuses mobile-camera page."""
    html = _STATIC / "mobile-camera.html"
    if not html.exists():
        return HTMLResponse("<h1>Camera client page not found</h1>", status_code=404)
    return FileResponse(str(html))


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(cameras.router,                    prefix="/api")
app.include_router(incidents.router,                  prefix="/api")
app.include_router(alerts.router,                     prefix="/api")
app.include_router(system.router,                     prefix="/api")
app.include_router(system._location_router,           prefix="/api")
app.include_router(dashboard.router,                  prefix="/api")
app.include_router(detections.router,                 prefix="/api")
app.include_router(monitoring.router,                 prefix="/api")
app.include_router(recognition_router.router,         prefix="/api")
app.include_router(mobile_router.router,              prefix="/api")


# ── Health & network info endpoints ──────────────────────────────────────────
@app.get("/", tags=["health"])
def root() -> dict:
    return {"status": "ok", "service": "Aegis AI API", "version": "3.1.0"}


@app.get("/api/health", tags=["health"])
def health() -> dict:
    from app.core.face_engine import face_engine
    from app.core.camera_adapters import camera_manager
    return {
        "status": "ok",
        "service": "Aegis AI API",
        "face_engine": face_engine.status["model_status"],
        "active_cameras": len(camera_manager.list_active()),
    }


@app.get("/network-info", tags=["health"])
@app.get("/api/network-info", tags=["health"])
def network_info() -> dict:
    """Returns LAN IP, port, and base URLs. Useful for diagnosing connectivity."""
    from app.core.network import get_server_info
    return get_server_info()


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    from app.core.websocket_manager import manager
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
