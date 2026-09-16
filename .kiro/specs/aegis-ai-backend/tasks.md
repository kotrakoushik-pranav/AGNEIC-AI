# Implementation Plan

## Overview

This plan covers the full implementation of Aegis AI Stage 2: a FastAPI + PostgreSQL backend and a React + TypeScript frontend dashboard. Tasks are ordered by dependency — backend infrastructure first, then API layers, then frontend scaffold, components, and finally integration verification.

## Tasks

- [x] 1. Backend project scaffold and configuration
  - Create `backend/` directory structure with `app/api/`, `app/models/`, `app/schemas/`, `app/services/`, `app/database/`, `app/core/`, `tests/`
  - Create `backend/requirements.txt` with pinned versions: fastapi==0.111.0, uvicorn[standard]==0.29.0, sqlalchemy==2.0.30, psycopg2-binary==2.9.9, pydantic-settings==2.2.1, python-dotenv==1.0.1, pytest==8.2.0, httpx==0.27.0
  - Create `backend/.env.example` with DATABASE_URL, CORS_ORIGINS, ENVIRONMENT placeholders
  - Create `backend/app/core/config.py` using pydantic-settings BaseSettings
  - Create `backend/app/database/session.py` with SQLAlchemy engine, SessionLocal, Base, and `get_db` dependency
  - Create `backend/app/core/exceptions.py` with global HTTP exception handler
  - Create `backend/app/core/websocket_manager.py` as a stub with TODO comment for Stage 6
  - Create `backend/app/main.py` with FastAPI app factory, CORS middleware, lifespan for `create_all`, and router registration stubs
  - _Requirements: R3, R10, R14_

- [x] 2. Backend database models
  - Create `backend/app/models/camera.py` — Camera ORM model with all columns (id, camera_code, name, location, status, stream_url, created_at, updated_at)
  - Create `backend/app/models/incident.py` — Incident ORM model with all columns and FK to Camera
  - Create `backend/app/models/alert.py` — Alert ORM model with all columns and FK to Incident
  - Create `backend/app/models/system_status.py` — SystemStatus ORM model
  - Create `backend/app/models/__init__.py` exporting all four models
  - Add DB indexes on `incidents.status`, `incidents.severity`, `incidents.detected_at`
  - _Requirements: R4_

- [x] 3. Backend Pydantic schemas
  - Create `backend/app/schemas/camera.py` — CameraResponse schema
  - Create `backend/app/schemas/incident.py` — IncidentCreate with validated severity enum and confidence 0.0–1.0, plus IncidentResponse
  - Create `backend/app/schemas/alert.py` — AlertResponse schema
  - Create `backend/app/schemas/system_status.py` — SystemStatusResponse schema
  - Create `backend/app/schemas/dashboard.py` — DashboardSummary schema with all aggregate fields
  - Create `backend/app/schemas/__init__.py` exporting all schemas
  - _Requirements: R5, R6, R7, R8, R9, R12_

- [x] 4. Backend service layer
  - Create `backend/app/services/camera_service.py` — get_all(db), get_by_id(db, id)
  - Create `backend/app/services/incident_service.py` — get_all, get_by_id, create, acknowledge, resolve
  - Create `backend/app/services/alert_service.py` — get_all(db)
  - Create `backend/app/services/system_service.py` — get_all_statuses(db), get_dashboard_summary(db)
  - Create `backend/app/services/__init__.py`
  - _Requirements: R5, R6, R7, R8, R14_

- [x] 5. Backend API routers
  - Create `backend/app/api/cameras.py` — GET /cameras, GET /cameras/{id}
  - Create `backend/app/api/incidents.py` — GET /incidents, GET /incidents/{id}, POST /incidents, PATCH /incidents/{id}/acknowledge, PATCH /incidents/{id}/resolve
  - Create `backend/app/api/alerts.py` — GET /alerts
  - Create `backend/app/api/system.py` — GET /system-health
  - Create `backend/app/api/dashboard.py` — GET /dashboard/summary
  - Create `backend/app/api/__init__.py`
  - Register all routers in `app/main.py` under `/api` prefix
  - _Requirements: R5, R6, R7, R8, R9_

- [x] 6. Backend seed script
  - Create `backend/seed.py` that calls `Base.metadata.create_all` then does idempotent inserts
  - Insert 4 Camera records: CAM-01 Main Entrance, CAM-02 Parking Area, CAM-03 Building A Corridor, CAM-04 Restricted Zone (all ONLINE)
  - Insert 3 Incident records: Possible Accident (CRITICAL, 0.94, CAM-02), Restricted Area Entry (HIGH, 0.91, CAM-04), Crowd Density Warning (MEDIUM, 0.87, CAM-01) — all ACTIVE
  - Insert 6 SystemStatus records for AI Engine, Video Processing, Backend, Database, Alert Service, Camera Network — all ONLINE
  - Insert 1 Alert record linked to the CRITICAL incident
  - Ensure running seed.py multiple times does not create duplicates
  - _Requirements: R11_

- [x] 7. Backend automated tests
  - Create `backend/tests/conftest.py` with SQLite in-memory test database, TestClient fixture, and `get_db` override
  - Create `backend/tests/test_cameras.py` — GET /api/cameras (200), GET /api/cameras/{id} (200), GET /api/cameras/999 (404)
  - Create `backend/tests/test_incidents.py` — GET list (200), GET by id (200/404), POST valid (201), POST missing field (422), POST confidence out-of-range (422)
  - Create `backend/tests/test_incidents_actions.py` — PATCH acknowledge (200, status=ACKNOWLEDGED), PATCH resolve (200, status=RESOLVED), PATCH nonexistent (404)
  - Create `backend/tests/test_alerts.py` — GET /api/alerts (200)
  - Create `backend/tests/test_system.py` — GET /api/system-health (200)
  - Create `backend/tests/test_dashboard.py` — GET /api/dashboard/summary (200, all required fields present)
  - Run `pytest` from `backend/` and fix all failures
  - _Requirements: R13_

- [x] 8. Frontend project scaffold
  - Scaffold `frontend/` Vite + React + TypeScript project using `npm create vite@latest`
  - Install dependencies: tailwindcss@3, postcss, autoprefixer, axios, lucide-react
  - Configure `tailwind.config.js` with custom dark theme tokens (surface #0d0f14, panel #13161d, border #1e2330, accent #00c8ff, critical #ff3b3b, warning #f59e0b)
  - Set up `frontend/src/index.css` with Tailwind directives and Inter font from Google Fonts
  - Create `frontend/.env.example` with VITE_API_BASE_URL=http://localhost:8000
  - Update `frontend/vite.config.ts` with base configuration
  - _Requirements: R1_

- [x] 9. Frontend TypeScript types and mock data
  - Create `frontend/src/types/index.ts` with Camera, Incident, Alert, SystemStatus, DashboardSummary TypeScript interfaces matching backend schemas exactly
  - Create `frontend/src/mock/mockData.ts` with realistic mock objects: 4 cameras, 3 incidents (Possible Accident CRITICAL, Restricted Area Entry HIGH, Crowd Density Warning MEDIUM), 6 system statuses, dashboard summary
  - _Requirements: R1, R2_

- [x] 10. Frontend service layer
  - Create `frontend/src/services/api.ts` — axios instance reading VITE_API_BASE_URL, response error interceptor
  - Create `frontend/src/services/cameraService.ts` — getCameras(), getCameraById(id) with typed returns
  - Create `frontend/src/services/incidentService.ts` — getIncidents(), getIncidentById(id), createIncident(data), acknowledgeIncident(id), resolveIncident(id)
  - Create `frontend/src/services/systemService.ts` — getSystemHealth(), getDashboardSummary()
  - Create `frontend/src/hooks/useDashboardData.ts` — polls all services on mount and every 30s, returns { summary, cameras, incidents, systemHealth, loading, error }, falls back to mockData on error with console warning
  - _Requirements: R2_

- [x] 11. Frontend layout shell
  - Create `frontend/src/components/layout/NavSidebar.tsx` — Aegis AI wordmark, SYSTEM ONLINE green badge, 8 nav items with lucide-react icons, active state with 3px cyan left border and 8–12% background opacity increase, 150ms hover transitions
  - Create `frontend/src/components/layout/TopHeader.tsx` — "Emergency Command Center" title (largest text), pulsing green SYSTEM OPERATIONAL dot, camera count, incident count, notification bell with red badge (hidden when 0), Operator/Admin profile label
  - Create `frontend/src/components/layout/MainLayout.tsx` — fixed sidebar + header, scrollable main content area
  - Create `frontend/src/components/shared/ErrorBanner.tsx` — "BACKEND CONNECTION LOST" red banner shown on error state
  - Create `frontend/src/components/shared/LoadingSpinner.tsx` — professional spinner component
  - Update `frontend/src/App.tsx` to render MainLayout with useDashboardData, passing data to panels
  - _Requirements: R1 (AC1–7), R2, R3_

- [x] 12. Frontend stat cards
  - Create `frontend/src/components/dashboard/StatCards.tsx` — 5 stat cards row (Active Incidents, Critical, Warnings, Cameras Online, AI Confidence) driven by DashboardSummary prop
  - Critical value rendered in red when > 0, Warnings in amber when > 0, AI Confidence in cyan
  - Hover border highlight transition in 150ms
  - Show LoadingSpinner when loading
  - _Requirements: R4_

- [x] 13. Frontend camera grid
  - Create `frontend/src/components/dashboard/CameraPanel.tsx` — dark CCTV gradient placeholder, red pulsing LIVE badge, running clock timestamp updated every second, cyan AI ACTIVE badge, person count label
  - Add AI bounding-box overlays: CAM-02 red box labeled "Possible Accident", CAM-04 amber box labeled "Restricted Entry"
  - Create `frontend/src/components/dashboard/CameraGrid.tsx` — 2×2 grid of 4 CameraPanel components with hover border color (red/amber/cyan) in 150ms
  - _Requirements: R5_

- [x] 14. Frontend incidents panel
  - Create `frontend/src/components/shared/SeverityBadge.tsx` — red bg for CRITICAL, amber for HIGH, yellow for MEDIUM
  - Create `frontend/src/components/shared/StatusChip.tsx` — styled chips for RESPONSE REQUIRED / UNDER REVIEW / MONITORING
  - Create `frontend/src/components/dashboard/IncidentsPanel.tsx` — incident rows with title, location, camera ID, SeverityBadge, confidence, StatusChip, timestamp; click-to-select with cyan left border; 150ms hover highlight; empty state "NO ACTIVE INCIDENTS — ALL MONITORED SYSTEMS NOMINAL"
  - Wire acknowledge and resolve buttons to incidentService functions
  - _Requirements: R6_

- [x] 15. Frontend right-column panels
  - Create `frontend/src/components/dashboard/IncidentTimeline.tsx` — 5 lifecycle entries in reverse-chronological order (most recent at top), colored dot indicators (red for Detection/Alert, cyan for Classification/Verification, green for Acknowledgement), most recent dot highlighted/larger
  - Create `frontend/src/components/dashboard/SystemHealthPanel.tsx` — 6 subsystem rows with colored status dots driven by systemHealth prop (green for ONLINE, amber for MOCK/DEV)
  - Create `frontend/src/components/dashboard/FacilityMap.tsx` — inline SVG with fictional facility (Main Entrance, Parking Area, Building A Corridor, Restricted Zone), 4 camera icon markers, pulsing red incident ring in Parking Area (1.5–3s cycle), hover tooltips with camera ID + location (disappear within 300ms on mouseout), legend
  - _Requirements: R7, R8, R9, R11_

- [x] 16. Frontend notification bell dropdown
  - Add dropdown state to TopHeader — clicking bell toggles a panel listing unacknowledged CRITICAL/HIGH incidents
  - Show "No active alerts" empty state message when no unacknowledged incidents
  - Hide red badge when unacknowledged count is zero
  - _Requirements: R3 (AC5), R11 (AC6–7)_

- [x] 17. Integration and end-to-end verification
  - Install backend dependencies: `pip install -r requirements.txt` in `backend/`
  - Create `backend/.env` from `.env.example` with local PostgreSQL DATABASE_URL
  - Run `python seed.py` from `backend/` — verify tables created and seed data inserted
  - Start backend with `uvicorn app.main:app --reload` — verify `/docs` loads and all endpoints return data
  - Create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8000`
  - Run `npm install` and `npm run dev` in `frontend/` — verify dashboard loads with backend data
  - Test every API endpoint through Swagger UI at http://localhost:8000/docs
  - Verify dashboard shows real DB data (camera names, incidents, system health from seed)
  - Test error fallback: stop backend, verify "BACKEND CONNECTION LOST" banner appears and mock data activates
  - Run `pytest` from `backend/` — all tests must pass
  - Fix all CORS, build, import, or runtime errors
  - _Requirements: All_


## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 8] },
    { "wave": 2, "tasks": [2, 9] },
    { "wave": 3, "tasks": [3, 10] },
    { "wave": 4, "tasks": [4, 11] },
    { "wave": 5, "tasks": [5, 6, 12, 13, 14, 15, 16] },
    { "wave": 6, "tasks": [7] },
    { "wave": 7, "tasks": [17] }
  ]
}
```

## Notes

- Backend tasks (1–7) are independent of frontend tasks (8–16) and can be developed in parallel.
- Task 17 requires a running PostgreSQL instance; update `backend/.env` with real credentials before running `seed.py`.
- All 28 pytest tests pass against SQLite in-memory DB — no PostgreSQL required for tests.
- Long-running servers (`uvicorn`, `npm run dev`) must be started manually by the developer.
