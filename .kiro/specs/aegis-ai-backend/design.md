# Design Document

## Overview

Aegis AI Stage 2 implements two parallel tracks: (1) the React + TypeScript frontend dashboard (Stage 1 UI, never built), and (2) a Python FastAPI backend with PostgreSQL that replaces all client-side mock data. The result is a fully operational local stack: `Browser → React Service Layer → FastAPI → SQLAlchemy → PostgreSQL`.

---

## 1. Repository Layout

```
webcam development/          ← workspace root
├── frontend/                ← Vite + React 18 + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── NavSidebar.tsx
│   │   │   │   ├── TopHeader.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatCards.tsx
│   │   │   │   ├── CameraGrid.tsx
│   │   │   │   ├── CameraPanel.tsx
│   │   │   │   ├── IncidentsPanel.tsx
│   │   │   │   ├── IncidentTimeline.tsx
│   │   │   │   ├── SystemHealthPanel.tsx
│   │   │   │   └── FacilityMap.tsx
│   │   │   └── shared/
│   │   │       ├── SeverityBadge.tsx
│   │   │       ├── StatusChip.tsx
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorBanner.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── cameraService.ts
│   │   │   ├── incidentService.ts
│   │   │   └── systemService.ts
│   │   ├── mock/
│   │   │   └── mockData.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── useDashboardData.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── backend/                 ← FastAPI + Python
    ├── app/
    │   ├── main.py
    │   ├── api/
    │   │   ├── __init__.py
    │   │   ├── cameras.py
    │   │   ├── incidents.py
    │   │   ├── alerts.py
    │   │   ├── system.py
    │   │   └── dashboard.py
    │   ├── models/
    │   │   ├── __init__.py
    │   │   ├── camera.py
    │   │   ├── incident.py
    │   │   ├── alert.py
    │   │   └── system_status.py
    │   ├── schemas/
    │   │   ├── __init__.py
    │   │   ├── camera.py
    │   │   ├── incident.py
    │   │   ├── alert.py
    │   │   ├── system_status.py
    │   │   └── dashboard.py
    │   ├── services/
    │   │   ├── __init__.py
    │   │   ├── camera_service.py
    │   │   ├── incident_service.py
    │   │   ├── alert_service.py
    │   │   └── system_service.py
    │   ├── database/
    │   │   ├── __init__.py
    │   │   └── session.py
    │   └── core/
    │       ├── __init__.py
    │       ├── config.py
    │       ├── exceptions.py
    │       └── websocket_manager.py   ← stub for Stage 6
    ├── tests/
    │   ├── __init__.py
    │   ├── conftest.py
    │   ├── test_cameras.py
    │   ├── test_incidents.py
    │   ├── test_alerts.py
    │   ├── test_system.py
    │   └── test_dashboard.py
    ├── seed.py
    ├── requirements.txt
    └── .env.example
```

---

## 2. Frontend Architecture

### Component Tree

```
App
└── MainLayout
    ├── NavSidebar          (fixed left, 240px wide)
    ├── TopHeader           (fixed top, 56px tall)
    └── main (scrollable)
        ├── StatCards       (5-column row)
        ├── section: left column (2/3 width)
        │   ├── CameraGrid (2×2)
        │   └── IncidentsPanel
        └── section: right column (1/3 width)
            ├── IncidentTimeline
            ├── SystemHealthPanel
            └── FacilityMap
```

### State Management

No Redux. Each panel uses `useState` + `useEffect` with the custom hook `useDashboardData` which polls the service layer every 30 seconds for fresh data.

```typescript
// hooks/useDashboardData.ts
function useDashboardData() {
  // returns { summary, cameras, incidents, systemHealth, loading, error }
  // on error, falls back to mockData
}
```

### Service Layer Pattern

```typescript
// services/api.ts
const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });
apiClient.interceptors.response.use(ok => ok, err => Promise.reject(err));

// services/cameraService.ts
export async function getCameras(): Promise<Camera[]>
export async function getCameraById(id: number): Promise<Camera>

// services/incidentService.ts
export async function getIncidents(): Promise<Incident[]>
export async function createIncident(data: IncidentCreate): Promise<Incident>
export async function acknowledgeIncident(id: number): Promise<Incident>
export async function resolveIncident(id: number): Promise<Incident>

// services/systemService.ts
export async function getSystemHealth(): Promise<SystemStatus[]>
export async function getDashboardSummary(): Promise<DashboardSummary>
```

### Mock Fallback

`src/mock/mockData.ts` exports the same shape as service layer responses. When `useDashboardData` catches a network error it logs a warning and returns mock data, while `ErrorBanner` shows "BACKEND CONNECTION LOST".

### Styling Approach

Tailwind CSS v3 with a custom dark theme config. Key design tokens:

```js
// tailwind.config.js
colors: {
  surface:   '#0d0f14',   // root bg
  panel:     '#13161d',   // card bg
  border:    '#1e2330',   // subtle borders
  accent:    '#00c8ff',   // cyan
  critical:  '#ff3b3b',   // red
  warning:   '#f59e0b',   // amber
  text:      '#e2e8f0',   // primary text
  muted:     '#64748b',   // secondary text
}
```

---

## 3. Backend Architecture

### App Factory (`app/main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import cameras, incidents, alerts, system, dashboard
from app.database.session import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)   # create tables on startup
    yield

app = FastAPI(title="Aegis AI API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
app.include_router(cameras.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
```

### Configuration (`app/core/config.py`)

Uses `pydantic-settings` `BaseSettings` — all values come from environment:

```python
class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    environment: str = "development"
    model_config = SettingsConfigDict(env_file=".env")
```

### Database Session (`app/database/session.py`)

```python
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Used as `db: Session = Depends(get_db)` in every router handler.

### Service Layer

Router handlers are thin — they call service functions:

```python
# api/incidents.py
@router.get("/incidents", response_model=list[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return incident_service.get_all(db)

# services/incident_service.py
def get_all(db: Session) -> list[Incident]:
    return db.query(Incident).order_by(Incident.detected_at.desc()).all()
```

---

## 4. Database Schema

```sql
CREATE TABLE cameras (
    id          SERIAL PRIMARY KEY,
    camera_code VARCHAR UNIQUE NOT NULL,
    name        VARCHAR NOT NULL,
    location    VARCHAR NOT NULL,
    status      VARCHAR NOT NULL DEFAULT 'ONLINE',
    stream_url  VARCHAR,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE incidents (
    id             SERIAL PRIMARY KEY,
    incident_type  VARCHAR NOT NULL,
    severity       VARCHAR NOT NULL,         -- CRITICAL|HIGH|MEDIUM|LOW
    confidence     FLOAT NOT NULL,
    camera_id      INTEGER REFERENCES cameras(id),
    location       VARCHAR NOT NULL,
    status         VARCHAR NOT NULL DEFAULT 'ACTIVE',
    description    VARCHAR,
    detected_at    TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP,
    resolved_at    TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
    id             SERIAL PRIMARY KEY,
    incident_id    INTEGER NOT NULL REFERENCES incidents(id),
    alert_type     VARCHAR NOT NULL,
    recipient      VARCHAR NOT NULL,
    status         VARCHAR NOT NULL DEFAULT 'SENT',
    created_at     TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP
);

CREATE TABLE system_status (
    id           SERIAL PRIMARY KEY,
    service_name VARCHAR UNIQUE NOT NULL,
    status       VARCHAR NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `incidents(status)`, `incidents(severity)`, `incidents(detected_at DESC)`

---

## 5. API Design

All endpoints under `/api`. Error format: `{"detail": "human readable message"}`.

| Method | Path | Description | Success |
|--------|------|-------------|---------|
| GET | /api/cameras | List all cameras | 200 |
| GET | /api/cameras/{id} | Get camera by ID | 200 / 404 |
| GET | /api/incidents | List all incidents (desc) | 200 |
| GET | /api/incidents/{id} | Get incident by ID | 200 / 404 |
| POST | /api/incidents | Create incident | 201 / 422 |
| PATCH | /api/incidents/{id}/acknowledge | Acknowledge incident | 200 / 404 |
| PATCH | /api/incidents/{id}/resolve | Resolve incident | 200 / 404 |
| GET | /api/alerts | List all alerts | 200 |
| GET | /api/system-health | List system statuses | 200 |
| GET | /api/dashboard/summary | Aggregated summary | 200 |

**Dashboard Summary Response:**
```json
{
  "active_incident_count": 3,
  "critical_count": 1,
  "warning_count": 1,
  "cameras_online_count": 4,
  "total_cameras": 4,
  "average_ai_confidence": 0.906,
  "recent_incidents": [...],
  "system_health": [...]
}
```

---

## 6. TypeScript Type Definitions

```typescript
// types/index.ts
export interface Camera {
  id: number; camera_code: string; name: string;
  location: string; status: string; stream_url: string | null;
  created_at: string; updated_at: string;
}

export interface Incident {
  id: number; incident_type: string; severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
  confidence: number; camera_id: number | null; location: string;
  status: string; description: string | null;
  detected_at: string; acknowledged_at: string | null;
  resolved_at: string | null; created_at: string;
}

export interface Alert {
  id: number; incident_id: number; alert_type: string;
  recipient: string; status: string;
  created_at: string; acknowledged_at: string | null;
}

export interface SystemStatus {
  id: number; service_name: string; status: string; last_updated: string;
}

export interface DashboardSummary {
  active_incident_count: number; critical_count: number;
  warning_count: number; cameras_online_count: number;
  total_cameras: number; average_ai_confidence: number;
  recent_incidents: Incident[]; system_health: SystemStatus[];
}
```

---

## 7. Key Implementation Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS framework | Tailwind CSS v3 | Utility-first, easy dark theme, no runtime overhead |
| HTTP client | Axios | Interceptors, typed responses, easy base URL config |
| State management | useState + useEffect | No complex global state needed at this stage |
| Test DB | SQLite in-memory | No external DB needed in CI; same SQLAlchemy ORM |
| Pydantic version | v2 | Required by latest FastAPI; use `model_config` |
| DB migrations | SQLAlchemy `create_all` | Sufficient for Stage 2; Alembic added in a later stage |
| Polling interval | 30s useEffect | Simple, no WebSocket needed until Stage 6 |

---

## 8. Development Setup

### Prerequisites
- Python 3.11+, Node.js 18+, PostgreSQL 14+

### Backend
```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL
pip install -r requirements.txt
python seed.py                # create tables + insert seed data
uvicorn app.main:app --reload # runs on http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
cp .env.example .env          # set VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                   # runs on http://localhost:5173
```

### Backend `.env.example`
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/aegis_ai
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ENVIRONMENT=development
```

### Frontend `.env.example`
```
VITE_API_BASE_URL=http://localhost:8000
```
