# Requirements Document

## Introduction

Aegis AI Stage 2 delivers two parallel tracks of work: (1) the implementation of the Stage 1 React + TypeScript frontend dashboard that was specified but never built, and (2) a new Python FastAPI backend with a PostgreSQL database that replaces the client-side mock data layer. At the end of Stage 2, a fully operational command-center web application runs locally — the React frontend calls real REST API endpoints, the backend serves camera, incident, alert, and system-health data from a seeded PostgreSQL database, and the design is the dark cinematic emergency-command-center UI specified in Stage 1. The system is architected to support future AI vision, WebSocket real-time feeds, and identity-verification modules in Stage 3+.

---

## Glossary

- **Dashboard**: The React + TypeScript single-page application that constitutes the frontend.
- **Operator**: A human user interacting with the Dashboard.
- **Incident**: A security or safety event record stored in PostgreSQL, classified by severity (CRITICAL, HIGH, MEDIUM).
- **Camera**: A physical or logical camera device represented by a database record with a unique `camera_code` (CAM-01 … CAM-04).
- **Alert**: A notification record linked to an Incident, representing a triggered alarm sent to a recipient channel.
- **SystemStatus**: A database record representing the health state of one named backend subsystem.
- **API**: The FastAPI HTTP service that exposes all data to the frontend.
- **Service Layer (frontend)**: TypeScript modules in `src/services/` that encapsulate all HTTP calls, returning typed promises to UI components.
- **Mock Data Layer (frontend)**: The existing client-side JavaScript data source from Stage 1 that the Service Layer replaces when the backend is available.
- **Seed Data**: A Python script that populates the database with representative initial records so the Dashboard is immediately usable after installation.
- **DTO / Schema**: A Pydantic model used to validate API request bodies and serialize API response payloads.
- **ORM Model**: A SQLAlchemy declarative class that maps to a PostgreSQL table.
- **Environment Variable**: A runtime configuration value loaded from a `.env` file, never hardcoded in source code.
- **CORS**: Cross-Origin Resource Sharing HTTP headers that allow the frontend (port 5173 / 3000) to call the backend (port 8000) during local development.
- **Swagger UI**: FastAPI's automatically generated interactive API documentation, accessible at `/docs`.

---

## Requirements

### Requirement 1: Frontend Implementation — Application Shell and Layout

**User Story:** As an Operator, I want the Stage 1 dashboard UI to be fully implemented in React + TypeScript so that I can interact with a working command-center interface.

#### Acceptance Criteria

1. THE Dashboard SHALL be implemented as a Vite + React + TypeScript project with all Stage 1 visual and interactive requirements from the existing `aegis-ai-dashboard` spec fulfilled.
2. THE Dashboard SHALL render a full-viewport layout with a fixed Nav Sidebar (left), a fixed Top Header (top), and a scrollable main content area, using background color `#0d0f14` and panel surface color `#13161d`.
3. THE Dashboard SHALL apply cyan/electric blue (`#00c8ff` range) as the primary accent, red (`#ff3b3b` range) for CRITICAL, and amber (`#f59e0b` range) for HIGH/WARNING severity indicators.
4. THE Nav_Sidebar SHALL display the Aegis AI wordmark, a "SYSTEM ONLINE" badge, and navigation items in this order: Dashboard, Live Cameras, Incidents, Alerts, Analytics, Authorized Identity, System Health, Settings — with icon and active-item highlight.
5. THE Top_Header SHALL display the title "Emergency Command Center", a pulsing "SYSTEM OPERATIONAL" indicator, active camera count, active incident count, notification bell with badge, and an operator profile label.
6. THE Incident_Overview_Stats row SHALL display five Stat Cards: Active Incidents, Critical, Warnings, Cameras Online, AI Confidence — with values driven by the Service Layer.
7. THE Camera_Grid SHALL render a 2×2 grid of Camera Panels for CAM-01 through CAM-04, each showing a dark placeholder frame, LIVE overlay, running timestamp, AI ACTIVE badge, person-count label, and mock AI bounding-box overlay where an incident is active.
8. THE Active_Incidents_Panel SHALL render the list of incidents returned by the Service Layer, showing title, location, camera ID, Severity Badge, confidence percentage, Status Chip, and detected timestamp.
9. THE Incident_Timeline SHALL render the five lifecycle stages (AI Detection, Incident Classification, Location Verification, Alert Generated, Operator Acknowledgement) with colored dot indicators and timestamps.
10. THE System_Health_Panel SHALL render six subsystem rows (AI Engine, Video Processing, Backend, Database, Alert Service, Camera Network) with status labels and colored status dots driven by the Service Layer.
11. THE Facility_Map SHALL render as an inline SVG depicting a fictional facility with four camera markers and a pulsing red incident marker in the Parking Area zone, with hover tooltips and a legend.
12. WHEN the Service Layer cannot reach the backend, THE Dashboard SHALL display a "BACKEND CONNECTION LOST" error banner and fall back to the Mock Data Layer so the UI remains functional.
13. WHEN no active incidents exist, THE Dashboard SHALL display an empty-state message "NO ACTIVE INCIDENTS — ALL MONITORED SYSTEMS NOMINAL" in the Active Incidents Panel.
14. WHILE data is loading from the Service Layer, THE Dashboard SHALL display professional loading spinners in each data-driven panel rather than broken or empty cards.

---

### Requirement 2: Frontend Service Layer

**User Story:** As a developer, I want a typed TypeScript service layer, so that all API communication is centralized, consistent, and easily swappable between mock and real data sources.

#### Acceptance Criteria

1. THE Service_Layer SHALL be implemented as TypeScript modules in `src/services/`: `api.ts` (base Axios/fetch configuration), `cameraService.ts`, `incidentService.ts`, and `systemService.ts`.
2. THE `api.ts` module SHALL read the backend base URL from a Vite environment variable (`VITE_API_BASE_URL`) and never hardcode a URL or port.
3. THE `cameraService.ts` module SHALL export typed async functions for: fetching all cameras and fetching a single camera by ID.
4. THE `incidentService.ts` module SHALL export typed async functions for: fetching all incidents, fetching a single incident by ID, creating a new incident, acknowledging an incident, and resolving an incident.
5. THE `systemService.ts` module SHALL export typed async functions for: fetching system health status and fetching the dashboard summary.
6. WHEN any service function receives an HTTP error response, THE Service_Layer SHALL throw a typed error that UI components can catch to display error states.
7. THE Service_Layer SHALL define TypeScript interfaces (`Camera`, `Incident`, `Alert`, `SystemStatus`, `DashboardSummary`) that match the backend API response schemas exactly.
8. WHEN `VITE_API_BASE_URL` is not set or the backend is unreachable, THE Service_Layer SHALL gracefully fall back to the Mock Data Layer and log a warning to the browser console.

---

### Requirement 3: Backend Project Structure and Configuration

**User Story:** As a developer, I want a well-organized FastAPI project, so that I can navigate, extend, and maintain the backend codebase efficiently.

#### Acceptance Criteria

1. THE Backend SHALL be organized into the directory structure: `backend/app/main.py`, `backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/database/`, `backend/app/core/`, `backend/tests/`, `backend/requirements.txt`, `backend/.env.example`.
2. THE Backend SHALL be runnable with `uvicorn app.main:app --reload` from the `backend/` directory.
3. THE Backend SHALL load all configuration values (database URL, secret key, CORS origins, environment name) exclusively from environment variables defined in a `.env` file.
4. THE `backend/.env.example` file SHALL list every required environment variable with a descriptive placeholder value but no real secrets.
5. THE Backend SHALL include a `requirements.txt` file listing all dependencies with pinned versions.
6. THE Backend SHALL expose FastAPI's interactive Swagger documentation at `/docs` and ReDoc at `/redoc` when running in development mode.
7. IF a required environment variable is missing at startup, THEN THE Backend SHALL raise a startup error with a descriptive message identifying the missing variable.

---

### Requirement 4: Database Models

**User Story:** As a developer, I want SQLAlchemy ORM models for all core entities, so that the database schema is defined in code and easily migrated or extended.

#### Acceptance Criteria

1. THE `Camera` ORM model SHALL define columns: `id` (integer, primary key, auto-increment), `camera_code` (string, unique, not null), `name` (string, not null), `location` (string, not null), `status` (string, not null, default "ONLINE"), `stream_url` (string, nullable), `created_at` (datetime, server default now), `updated_at` (datetime, auto-updated on modification).
2. THE `Incident` ORM model SHALL define columns: `id` (integer, primary key), `incident_type` (string, not null), `severity` (string, not null), `confidence` (float, not null), `camera_id` (integer, foreign key → Camera.id, nullable), `location` (string, not null), `status` (string, not null, default "ACTIVE"), `description` (string, nullable), `detected_at` (datetime, not null), `acknowledged_at` (datetime, nullable), `resolved_at` (datetime, nullable), `created_at` (datetime, server default now).
3. THE `Alert` ORM model SHALL define columns: `id` (integer, primary key), `incident_id` (integer, foreign key → Incident.id, not null), `alert_type` (string, not null), `recipient` (string, not null), `status` (string, not null, default "SENT"), `created_at` (datetime, server default now), `acknowledged_at` (datetime, nullable).
4. THE `SystemStatus` ORM model SHALL define columns: `id` (integer, primary key), `service_name` (string, unique, not null), `status` (string, not null), `last_updated` (datetime, auto-updated on modification).
5. ALL ORM models SHALL be defined using SQLAlchemy declarative base and SHALL be importable from `app.models`.
6. THE database connection SHALL be configured via a `DATABASE_URL` environment variable and managed through a SQLAlchemy `SessionLocal` factory defined in `app/database/`.
7. WHEN the backend starts, THE database engine SHALL verify connectivity and log a success or failure message; IF connectivity fails, THEN THE Backend SHALL log the error and exit with a non-zero status code.

---

### Requirement 5: API Endpoints — Cameras

**User Story:** As an Operator, I want camera data served from the backend, so that the dashboard displays real persisted camera information.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/cameras` that returns an array of all Camera records serialized as JSON.
2. THE API SHALL expose `GET /api/cameras/{id}` that returns a single Camera record by integer ID.
3. IF `GET /api/cameras/{id}` is called with an ID that does not exist in the database, THEN THE API SHALL return HTTP 404 with a JSON error body containing a `detail` field.
4. ALL Camera responses SHALL include fields: `id`, `camera_code`, `name`, `location`, `status`, `stream_url`, `created_at`, `updated_at`.
5. THE Camera endpoints SHALL use a Pydantic response schema (`CameraResponse`) that validates and serializes all returned fields.

---

### Requirement 6: API Endpoints — Incidents

**User Story:** As an Operator, I want incident data managed through the API, so that I can view, create, acknowledge, and resolve incidents from the dashboard.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/incidents` that returns an array of all Incident records, ordered by `detected_at` descending.
2. THE API SHALL expose `GET /api/incidents/{id}` that returns a single Incident record by integer ID.
3. IF `GET /api/incidents/{id}` is called with an ID that does not exist, THEN THE API SHALL return HTTP 404 with a JSON `detail` field.
4. THE API SHALL expose `POST /api/incidents` that accepts a JSON body validated by the `IncidentCreate` Pydantic schema and creates a new Incident record, returning HTTP 201 with the created record.
5. THE `IncidentCreate` schema SHALL require: `incident_type` (string), `severity` (one of "CRITICAL", "HIGH", "MEDIUM"), `confidence` (float between 0.0 and 1.0), `location` (string), `description` (optional string), `camera_id` (optional integer), `detected_at` (datetime).
6. THE API SHALL expose `PATCH /api/incidents/{id}/acknowledge` that sets the incident's `acknowledged_at` to the current UTC time and updates `status` to "ACKNOWLEDGED", returning the updated record.
7. THE API SHALL expose `PATCH /api/incidents/{id}/resolve` that sets the incident's `resolved_at` to the current UTC time and updates `status` to "RESOLVED", returning the updated record.
8. IF `PATCH /api/incidents/{id}/acknowledge` or `PATCH /api/incidents/{id}/resolve` is called with a non-existent ID, THEN THE API SHALL return HTTP 404.
9. WHEN a `POST /api/incidents` request body fails Pydantic validation, THE API SHALL return HTTP 422 with a structured validation error response.
10. ALL Incident responses SHALL include all model columns serialized as JSON with datetime fields in ISO 8601 format.

---

### Requirement 7: API Endpoints — Alerts

**User Story:** As an Operator, I want alert records available through the API, so that the notification system can display triggered alarms.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/alerts` that returns an array of all Alert records, ordered by `created_at` descending.
2. ALL Alert responses SHALL include fields: `id`, `incident_id`, `alert_type`, `recipient`, `status`, `created_at`, `acknowledged_at`.
3. THE Alert endpoint SHALL use a Pydantic response schema (`AlertResponse`) that validates and serializes all returned fields.

---

### Requirement 8: API Endpoints — System Health

**User Story:** As an Operator, I want the backend to report the operational status of all system components, so that the System Health Panel reflects real service states.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/system-health` that returns an array of all SystemStatus records.
2. ALL SystemStatus responses SHALL include fields: `id`, `service_name`, `status`, `last_updated`.
3. THE SystemStatus endpoint SHALL use a Pydantic response schema (`SystemStatusResponse`).

---

### Requirement 9: API Endpoints — Dashboard Summary

**User Story:** As an Operator, I want a single aggregated summary endpoint, so that the dashboard overview stats can be loaded in one request rather than multiple round-trips.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/dashboard/summary` that returns a single JSON object with computed aggregate fields.
2. THE summary response SHALL include: `active_incident_count` (integer), `critical_count` (integer), `warning_count` (integer), `cameras_online_count` (integer), `total_cameras` (integer), `average_ai_confidence` (float, computed from active incidents, or 0.0 if none).
3. THE summary response SHALL be serialized by a Pydantic response schema (`DashboardSummary`).
4. THE `average_ai_confidence` SHALL be computed as the mean of `confidence` values across all Incident records whose `status` is "ACTIVE".

---

### Requirement 10: CORS Configuration

**User Story:** As a developer, I want CORS configured on the backend, so that the React frontend can call the API from the browser without cross-origin errors during local development.

#### Acceptance Criteria

1. THE Backend SHALL add FastAPI CORS middleware configured to allow origins specified by the `CORS_ORIGINS` environment variable.
2. THE CORS configuration SHALL allow the HTTP methods: GET, POST, PATCH, OPTIONS.
3. THE CORS configuration SHALL allow the HTTP headers: Content-Type, Authorization.
4. THE `CORS_ORIGINS` environment variable SHALL default to `http://localhost:5173,http://localhost:3000` when not explicitly set.
5. THE Backend SHALL NOT use a wildcard (`*`) CORS origin in any environment where `CORS_ORIGINS` is explicitly configured.

---

### Requirement 11: Seed Data

**User Story:** As a developer, I want the database seeded with representative data, so that the dashboard is fully populated immediately after installation without manual data entry.

#### Acceptance Criteria

1. THE seed script SHALL insert exactly four Camera records: CAM-01 Main Entrance, CAM-02 Parking Area, CAM-03 Building A Corridor, CAM-04 Restricted Zone — all with status "ONLINE".
2. THE seed script SHALL insert at least three Incident records: "Possible Accident" (CRITICAL, 0.94, CAM-02), "Restricted Area Entry" (HIGH, 0.91, CAM-04), "Crowd Density Warning" (MEDIUM, 0.87, CAM-01) — all with status "ACTIVE".
3. THE seed script SHALL insert SystemStatus records for each of the six subsystems: AI Engine (ONLINE), Video Processing (ONLINE), Backend (ONLINE), Database (ONLINE), Alert Service (ONLINE), Camera Network (ONLINE).
4. THE seed script SHALL insert at least one Alert record linked to the CRITICAL incident.
5. THE seed script SHALL be idempotent: running it multiple times SHALL NOT create duplicate records.
6. THE seed script SHALL be executable as a standalone Python script from the `backend/` directory.

---

### Requirement 12: Input Validation and Error Handling

**User Story:** As a developer, I want consistent validation and error responses across all API endpoints, so that the frontend can reliably handle and display error states.

#### Acceptance Criteria

1. ALL API endpoints SHALL use Pydantic schemas to validate request data; invalid data SHALL return HTTP 422 with structured error details.
2. ALL API endpoints SHALL return error responses as JSON objects with at minimum a `detail` field containing a human-readable message.
3. WHEN an unhandled server exception occurs, THE API SHALL return HTTP 500 with a generic `detail` message and log the full exception traceback server-side.
4. THE Backend SHALL define a global exception handler that catches `HTTPException` and returns a consistent JSON error structure.
5. ALL float fields in request schemas (e.g., `confidence`) SHALL be validated to be within defined bounds; out-of-range values SHALL return HTTP 422.

---

### Requirement 13: Automated Tests

**User Story:** As a developer, I want a pytest test suite covering all API endpoints, so that I can verify backend correctness and catch regressions.

#### Acceptance Criteria

1. THE test suite SHALL be located in `backend/tests/` and runnable with `pytest` from the `backend/` directory.
2. THE test suite SHALL use an in-memory SQLite database or a test-specific PostgreSQL database, never the production database.
3. THE test suite SHALL include at least one test per endpoint covering the happy-path response (correct status code and response body shape).
4. THE test suite SHALL include tests for 404 responses on `GET /api/cameras/{id}`, `GET /api/incidents/{id}`.
5. THE test suite SHALL include a test for HTTP 422 response on `POST /api/incidents` with an invalid request body (e.g., missing required field, `confidence` out of range).
6. THE test suite SHALL include tests for `PATCH /api/incidents/{id}/acknowledge` and `PATCH /api/incidents/{id}/resolve` verifying status transitions.
7. EACH test function SHALL be independent and SHALL NOT rely on state created by another test function.

---

### Requirement 14: Future-Proofing Architecture

**User Story:** As a developer, I want the backend architecture to support future AI vision, WebSocket, and identity-verification modules, so that Stage 3+ can extend the system without major refactoring.

#### Acceptance Criteria

1. THE Backend router structure SHALL use FastAPI `APIRouter` with one router file per resource (cameras, incidents, alerts, system, dashboard) mounted under `/api` in `main.py`, so new routers can be added independently.
2. THE `app/services/` layer SHALL contain business-logic functions that are called by router handlers and are independently testable without HTTP context.
3. THE database session management SHALL use FastAPI dependency injection (`Depends`) so that future WebSocket handlers or background tasks can reuse the same pattern.
4. THE `Camera` model's `stream_url` field SHALL be nullable to allow future live-stream URL injection from a webcam ingestion service.
5. THE Backend SHALL include at least one placeholder comment or stub in `app/core/` (e.g., `websocket_manager.py`) indicating where future WebSocket and AI event-stream integrations will be added.
