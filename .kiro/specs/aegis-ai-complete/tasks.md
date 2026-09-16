# Implementation Plan: Aegis AI Complete

## Overview

Implements nine completion areas across six parallel-safe waves: backend model/schema extensions, new alert API endpoints and services, frontend type extensions and alert services, GPS and dashboard hooks, new UI components, and final integration wiring. All changes extend existing files or add new files — nothing is rewritten from scratch.

---

## Tasks

- [ ] 1. Wave 1 — Backend Foundation (parallel)

  - [ ] 1.1 Extend Alert model with delivery tracking columns
    - Add `delivery_status`, `dispatch_payload`, `error_reason`, `confirmation_at`, `dispatched_at` columns to `Alert` in `backend/app/models/alert.py`
    - Import `Text` from sqlalchemy alongside existing imports
    - Update `AlertResponse` Pydantic schema in `backend/app/schemas/alert.py` to expose all five new fields plus `AlertDispatchRequest` class
    - _Requirements: 6.1, 6.2_

  - [ ] 1.2 Add alert_destinations router and endpoint
    - Create `backend/app/api/alert_destinations.py` with `GET /alert-destinations` returning `AlertDestinationsResponse`
    - Define `DESTINATION_DEFS` list for all five categories (Medical, Fire/Rescue, Police, Disaster_Response, Local_Emergency)
    - Read `ALERT_DEST_*` env vars via `os.getenv`; report `CONFIGURED` when non-empty, `NOT_CONFIGURED` otherwise
    - Include credentials check (`ALERT_KEY_*`) but never expose credential values in response
    - Register the new router in `backend/app/main.py` under `prefix="/api"`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 1.3 Write property test for alert-destinations endpoint
    - **Property 9: Destination status reflects env var configuration for any combination**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**
    - Create `backend/tests/test_alert_destinations.py`; parametrize over all 32 subsets of the five ALERT_DEST vars (set vs empty) using `monkeypatch.setenv`
    - Assert returned `status` is `CONFIGURED` for set vars and `NOT_CONFIGURED` for empty/absent ones; assert no key values appear in any field

  - [ ] 1.4 Add alert_message_service (pure formatting, no I/O)
    - Create `backend/app/services/alert_message_service.py`
    - Implement `format_alert_message(alert, incident, camera_name, gps_lat, gps_lon, gps_accuracy) -> str`
    - First line MUST be `"AEGIS-AI EMERGENCY ALERT"`; separator line; then labeled fields: Alert ID, Severity, Type, Camera, Detected (ISO 8601), Confidence (rounded to 1 decimal %), Location (GPS string or `"GPS: UNAVAILABLE"`); closing separator and footer sentence
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 1.5 Write property test for alert_message_service
    - **Property 10: Alert message always contains all required fields**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - Create `backend/tests/test_alert_message_service.py`
    - Use Hypothesis `@given` strategies to generate arbitrary Alert/Incident-like objects with varying GPS presence
    - Assert every generated message starts with `"AEGIS-AI EMERGENCY ALERT"`, contains the alert ID, severity, ISO timestamp, confidence as `%`, and either `"GPS: UNAVAILABLE"` or the GPS coordinate fields

  - [ ] 1.6 Update backend .env and .env.example with new variables
    - Append to `backend/.env`: `ALERT_DEST_MEDICAL`, `ALERT_DEST_FIRE`, `ALERT_DEST_POLICE`, `ALERT_DEST_DISASTER`, `ALERT_DEST_LOCAL`, `ALERT_KEY_MEDICAL`, `ALERT_KEY_FIRE`, `ALERT_KEY_POLICE`, `ALERT_KEY_DISASTER`, `ALERT_KEY_LOCAL`, `ALERT_DISPATCH_TIMEOUT=30`, `DEMO_MODE=false`
    - Mirror all additions in `backend/.env.example` with descriptive comments
    - Append to `frontend/.env.example`: `VITE_DEMO_MODE=false` with description
    - _Requirements: 4.1, 9.4, 9.6, 9.8_

- [ ] 2. Wave 2 — Backend Dispatch (depends on Wave 1)

  - [ ] 2.1 Add alert_dispatch_service (async httpx delivery)
    - Create `backend/app/services/alert_dispatch_service.py`
    - Implement `async def dispatch(alert_id, gps_lat, gps_lon, gps_accuracy) -> None`
    - Fetch alert + incident from DB; look up camera name; call `alert_message_service.format_alert_message`
    - Iterate over `DESTINATION_DEFS`; skip any category whose env var is empty
    - For each configured destination: `httpx.AsyncClient` POST with text/plain body and `Authorization` header when `ALERT_KEY_*` is set; timeout from `ALERT_DISPATCH_TIMEOUT` env var (default 30)
    - On HTTP 2xx: set `delivery_status = "SENT"`; on 4xx/5xx or timeout: set `delivery_status = "FAILED"`, set `error_reason`
    - Store `dispatch_payload` as JSON `{"message": "...", "destinations_attempted": [...]}`
    - Broadcast `alert_status_updated` WS event after each terminal state via `ws_manager.broadcast`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.2 Write property test for alert_dispatch_service delivery status
    - **Property 12: Successful delivery never falsely confirmed**
    - **Property 13: Failed delivery always records error reason**
    - **Validates: Requirements 6.3, 6.4, 6.5**
    - Create `backend/tests/test_alert_dispatch.py`
    - Mock `httpx.AsyncClient.post` with Hypothesis-generated HTTP status codes
    - Assert: status codes in 200–299 → `delivery_status == "SENT"` and `error_reason` is None; all other codes → `delivery_status == "FAILED"` and `error_reason` is non-None

  - [ ] 2.3 Add POST /api/alerts/{id}/dispatch endpoint
    - Add `dispatch_alert` endpoint to `backend/app/api/alerts.py`
    - Accept `AlertDispatchRequest` body (GPS fields only); validate alert exists (404) and is not already dispatched (409)
    - Set `delivery_status = "SENDING"`, `dispatched_at = now()`, commit, then enqueue `alert_dispatch_service.dispatch` as `BackgroundTask`
    - Broadcast `alert_status_updated` WS event with `delivery_status="SENDING"` immediately
    - Return updated `AlertResponse`
    - _Requirements: 6.1, 6.2, 5.5_

  - [ ] 2.4 Add GET /api/alerts/{id}/message-preview endpoint
    - Add `get_message_preview` endpoint to `backend/app/api/alerts.py`
    - Accept optional query params `lat`, `lon`, `accuracy`; fetch alert + incident + camera from DB; call `alert_message_service.format_alert_message`
    - Return `{"message": "<formatted string>"}` without persisting anything
    - Return 404 if alert not found
    - _Requirements: 5.6_

  - [ ] 2.5 Update PATCH /api/alerts/{id}/acknowledge for new status flow
    - Modify `acknowledge_alert` in `backend/app/api/alerts.py` to set `status = "ACKNOWLEDGED"` (keep existing behavior)
    - Ensure the endpoint works correctly when `delivery_status` is `NULL` (DISMISS path from modal)
    - Broadcast `alert_updated` WS event with `status: "ACKNOWLEDGED"` (keep existing behavior)
    - _Requirements: 3.10_

  - [ ] 2.6 Broadcast alert_pending WS event in monitor.py for CRITICAL/HIGH incidents
    - In `backend/app/core/monitor.py`, after creating the `Alert` record for a CRITICAL or HIGH severity incident, fetch the camera name and broadcast `alert_pending` WS event
    - Payload: `{alert_id, incident_id, incident_type, camera_name, detected_at, confidence, severity}`
    - Set `alert.status = "PENDING_REVIEW"` instead of `"ACTIVE"` for CRITICAL/HIGH alerts
    - _Requirements: 3.1_

  - [ ]* 2.7 Write property test for dispatch endpoint guard conditions
    - **Property 6: Alert dispatch never fires before operator confirmation**
    - **Validates: Requirements 3.8, 6.2**
    - Add tests in `backend/tests/test_alert_dispatch.py`
    - Test 404 for non-existent alert ID
    - Test 409 when `delivery_status` is already `SENDING`, `SENT`, or `DELIVERY_CONFIRMED`
    - Test that `delivery_status` is set to `SENDING` immediately on a valid request

- [ ] 3. Checkpoint — Backend foundation and dispatch complete
  - Ensure all backend pytest tests pass: `cd backend && python -m pytest tests/ -v`
  - Verify `GET /api/alert-destinations` returns correct shape
  - Verify `POST /api/alerts/{id}/dispatch` returns 404 for missing alert, 409 for already-dispatched

- [ ] 4. Wave 3 — Frontend Types and Services (depends on Wave 1)

  - [ ] 4.1 Extend frontend types with new Alert fields and supplementary types
    - In `frontend/src/types/index.ts`, extend the `Alert` interface with `delivery_status`, `error_reason`, `dispatched_at`, `confirmation_at` fields
    - Add `GpsStatus` type union
    - Add `AlertDestination` interface
    - Add `WsAlertPending` interface
    - Add `WsAlertStatusUpdated` interface
    - _Requirements: 6.7, 2.1, 4.7, 3.1_

  - [ ] 4.2 Create alertService.ts with all alert-related API functions
    - Create `frontend/src/services/alertService.ts`
    - Add `getAlerts(): Promise<Alert[]>` — GET /api/alerts
    - Add `getAlertDestinations(): Promise<{ destinations: AlertDestination[]; any_configured: boolean }>` — GET /api/alert-destinations
    - Add `dispatchAlert(alertId: number, gpsLat: number | null, gpsLon: number | null, gpsAccuracy: number | null): Promise<Alert>` — POST /api/alerts/{id}/dispatch
    - Add `acknowledgeAlert(alertId: number): Promise<Alert>` — PATCH /api/alerts/{id}/acknowledge
    - Add `getMessagePreview(alertId: number, lat?: number, lon?: number, accuracy?: number): Promise<{ message: string }>` — GET /api/alerts/{id}/message-preview
    - All functions use `apiClient` from `./api`
    - _Requirements: 3.8, 3.9, 3.10, 4.7, 5.6_

- [ ] 5. Wave 4 — Frontend Hooks (depends on Wave 3)

  - [ ] 5.1 Create useGps.ts hook with GPS state machine
    - Create `frontend/src/hooks/useGps.ts`
    - Export `GpsStatus` type and `GpsState` interface
    - On mount: call `navigator.permissions.query({ name: 'geolocation' })` — reads permission without prompting
    - Map permission state `"prompt"` → `PERMISSION_REQUIRED`, `"denied"` → `DENIED`, `"granted"` → start `watchPosition` and set `AVAILABLE` on first fix
    - If `navigator.geolocation` is undefined, set `UNAVAILABLE` immediately
    - Implement `requestPermission()`: calls `getCurrentPosition` (triggers browser prompt), on success starts `watchPosition`
    - Every `watchPosition` position event updates lat/lon/accuracy/timestamp in state — never fabricated values
    - Cleanup on unmount: call `clearWatch(watchId)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.13, 2.14_

  - [ ]* 5.2 Write property test for useGps hook
    - **Property 3: GPS coordinates are only ever sourced from the Geolocation API**
    - **Property 4: GPS panel renders correct UI for any status**
    - **Validates: Requirements 2.7, 2.8, 2.10, 2.11, 2.12, 2.13, 2.14**
    - Write Vitest tests in `frontend/src/hooks/useGps.test.ts` using `@testing-library/react` `renderHook`
    - Mock `navigator.geolocation` and `navigator.permissions`; use fast-check `fc.record` to generate arbitrary position events
    - Assert that every value stored in `GpsState` is exactly the value from the mocked position event (no rounding, no fabrication)

  - [ ] 5.3 Extend useDashboardData.ts with alert queue and alert_status_updated handler
    - In `frontend/src/hooks/useDashboardData.ts`, add `alertQueue: WsAlertPending[]` state
    - Add `alerts: Alert[]` state fetched from `alertService.getAlerts()` in `fetchData`
    - In the WS `onmessage` handler, add `alert_pending` branch: push to `alertQueue`
    - Add `alert_status_updated` branch: update matching alert's `delivery_status` and `error_reason` in `alerts` array
    - Export `alertQueue`, `alerts`, and a `removeFromQueue(alertId: number)` function from the hook
    - Update the `DashboardState` interface to include the new fields
    - _Requirements: 3.1, 3.2, 3.12, 6.7, 6.8_

  - [ ]* 5.4 Write property test for useDashboardData alert queue
    - **Property 8: Alert queue count indicator reflects pending queue size**
    - **Validates: Requirements 3.12**
    - Write Vitest tests in `frontend/src/hooks/useDashboardData.test.ts`
    - Mock WebSocket; fire N `alert_pending` events while modal is "open" (queue not cleared)
    - Assert `alertQueue.length === N` after N events

- [ ] 6. Checkpoint — Frontend hooks and services compile clean
  - Run `cd frontend && npx tsc --noEmit` — zero TypeScript errors expected before component work begins

- [ ] 7. Wave 5 — Frontend Components (depends on Wave 4)

  - [ ] 7.1 Create BackendOfflineScreen.tsx
    - Create `frontend/src/components/shared/BackendOfflineScreen.tsx`
    - Props: `{ onRetry: () => void; isRetrying: boolean }`
    - Render full-viewport centered layout with "BACKEND OFFLINE" heading in high-contrast red
    - Explanation text: "Cannot reach backend at http://localhost:8000"
    - "RETRY CONNECTION" button — disabled and shows loading spinner while `isRetrying=true`
    - _Requirements: 1.3, 1.4, 1.5, 1.8_

  - [ ] 7.2 Create StartupGate wrapper component
    - Create `frontend/src/components/shared/StartupGate.tsx` (or inline in `main.tsx`)
    - States: `checking`, `backend_offline`, `ready`
    - On mount: run `runStartupChecks()` using `Promise.allSettled` — probe health, cameras, destinations, WebSocket concurrently with 10-second `AbortController` timeout each; read GPS permission synchronously
    - If health probe fails: render `<BackendOfflineScreen onRetry={...} isRetrying={...} />`
    - If health probe succeeds: pass `StartupCheckResults` down to `<App>` as props and render it
    - Retry button re-executes `runStartupChecks()`; disable during retry (set `isRetrying=true`)
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 8.1, 8.2, 8.4, 8.5, 8.7_

  - [ ]* 7.3 Write property test for StartupGate offline rendering
    - **Property 1: Any health check failure renders the offline screen**
    - **Validates: Requirements 1.2**
    - Write Vitest test in `frontend/src/components/shared/StartupGate.test.tsx`
    - Mock `fetch` to return non-2xx codes or throw network errors; use fast-check to generate arbitrary HTTP status codes ≥ 300
    - Assert `BackendOfflineScreen` is rendered and main layout is NOT rendered for every failure case

  - [ ] 7.4 Create SystemStatusPanel.tsx
    - Create `frontend/src/components/shared/SystemStatusPanel.tsx`
    - Props: `{ subsystems: SubsystemState[] }`
    - Export `SubsystemName`, `SubsystemStatus`, `SubsystemState` types
    - Render six rows (Backend, Camera, WebSocket, GPS, AI_Engine, Alert_Service) with color-coded status chips
    - All values come exclusively from props — no internal async fetching, no hardcoded fallbacks
    - _Requirements: 7.1, 7.2, 7.14_

  - [ ]* 7.5 Write property test for SystemStatusPanel derivation
    - **Property 15: System status panel derives each subsystem from real state**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14**
    - Write Vitest test in `frontend/src/components/shared/SystemStatusPanel.test.tsx`
    - Use fast-check to generate arbitrary `SubsystemState[]` arrays covering all valid status values
    - Assert rendered text content matches the input values exactly with no substitution

  - [ ] 7.6 Create AlertConfirmationModal.tsx
    - Create `frontend/src/components/alerts/AlertConfirmationModal.tsx`
    - Props: `{ alert: PendingAlert; gpsState: GpsState; destinations: AlertDestination[]; messagePreview: string | null; previewError: boolean; onSend: (alertId: number) => void; onDismiss: (alertId: number) => void; pendingQueueCount: number; isSending: boolean }`
    - Render incident type, camera name, detection timestamp, AI confidence, severity — all five required fields always visible
    - GPS: show lat/lon/accuracy when `gpsState.status === 'AVAILABLE'`; else "Location unavailable"
    - Destination list: each category as green "CONFIGURED" or grey "NOT CONFIGURED"
    - Read-only monospace textarea for message preview; show error text and disable SEND when `previewError=true`
    - SEND button disabled when `previewError=true` or `isSending=true`; DISMISS always enabled
    - Badge "+ {n} more pending" when `pendingQueueCount > 0`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 5.6_

  - [ ]* 7.7 Write property test for AlertConfirmationModal required fields
    - **Property 7: Alert modal displays all required incident fields for any alert**
    - **Validates: Requirements 3.3**
    - Write Vitest test in `frontend/src/components/alerts/AlertConfirmationModal.test.tsx`
    - Use fast-check `fc.record` to generate arbitrary `PendingAlert` objects
    - Assert all five fields (incident type, camera name, timestamp, confidence, severity) are rendered in the DOM for every generated alert

  - [ ] 7.8 Create AlertDestinationsPage.tsx (Settings page)
    - Create `frontend/src/components/settings/AlertDestinationsPage.tsx`
    - On mount: call `alertService.getAlertDestinations()`; display loading state then render all five categories with their `CONFIGURED` / `NOT_CONFIGURED` status
    - No credentials displayed; only category name, status chip, and the env var name for operator reference
    - Accessible from the existing "Settings" nav entry (`id: 'settings'` in NavSidebar)
    - _Requirements: 4.8, 4.9_

  - [ ] 7.9 Add GPS panel display to dashboard layout
    - In `frontend/src/App.tsx`, import `useGps` and call it to get `gpsState`
    - Pass `gpsState` down where needed (modal, system status panel)
    - Add a GPS panel UI element to the right-side column in the dashboard `renderPage` branch
    - Panel shows: latitude/longitude/accuracy/timestamp when `AVAILABLE`; "ENABLE LOCATION" button when `PERMISSION_REQUIRED`; "Location access denied" when `DENIED`; "Geolocation not supported" when `UNAVAILABLE`
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [ ] 7.10 Add DEMO_MODE banner to App.tsx
    - In `frontend/src/App.tsx`, add `const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'`
    - Conditionally render a fixed top banner (`z-50`, amber background) with text "⚠ DEMO MODE — Data is simulated"
    - _Requirements: 9.1, 9.7_

- [ ] 8. Checkpoint — All components render without TypeScript errors
  - Run `cd frontend && npx tsc --noEmit` — must complete with zero errors

- [ ] 9. Wave 6 — Integration and Wiring (depends on all waves)

  - [ ] 9.1 Wire StartupGate and all new components into App.tsx and main.tsx
    - Update `frontend/src/main.tsx` to wrap `<App>` with `<StartupGate>`
    - In `frontend/src/App.tsx`: import and render `<SystemStatusPanel>` with derived subsystems from `backendOnline`, `wsConnected`, `cameras`, `gpsState`, health data, and destination data
    - Render `<AlertConfirmationModal>` when `alertQueue.length > 0`: use `alertQueue[0]` as current alert, `alertQueue.length - 1` as `pendingQueueCount`
    - `onSend`: call `alertService.dispatchAlert` with GPS coords then `removeFromQueue`
    - `onDismiss`: call `alertService.acknowledgeAlert` then `removeFromQueue`
    - Fetch `messagePreview` via `alertService.getMessagePreview` when modal opens; set `previewError` on failure
    - _Requirements: 1.1, 3.2, 3.8, 3.9, 3.10, 7.2, 8.1, 8.5_

  - [ ]* 9.2 Write property test for backend connection loss state retention
    - **Property 2: Backend connection loss retains last known state**
    - **Validates: Requirements 1.9**
    - Write Vitest test in `frontend/src/hooks/useDashboardData.test.ts`
    - Load initial state; mock fetch to reject; trigger re-poll; assert state values are unchanged (not zeroed)

  - [ ]* 9.3 Write property test for non-backend startup probe failures
    - **Property 16: Non-backend startup probe failures do not block main layout**
    - **Validates: Requirements 8.6**
    - Write Vitest test in `frontend/src/components/shared/StartupGate.test.tsx`
    - Mock health probe to succeed and other probes to fail
    - Assert `<App>` (main layout) is rendered despite probe failures

  - [ ] 9.4 Add Settings/Destinations page to App.tsx router and NavSidebar
    - In `frontend/src/App.tsx`, add `case 'settings': return <AlertDestinationsPage />;` to `renderPage`
    - NavSidebar already has `{ id: 'settings', label: 'Settings', icon: <Settings size={18} /> }` — verify it routes to the new page; no change needed if already present
    - _Requirements: 4.9_

  - [ ] 9.5 Update AlertsPage.tsx to display delivery_status and error_reason
    - In `frontend/src/components/alerts/AlertsPage.tsx`, replace inline `getAlerts`/`acknowledgeAlert` functions with imports from `alertService`
    - Add delivery status badge next to existing status chip for each alert
    - When `delivery_status === 'FAILED'`: render `error_reason` text below the alert row
    - When `delivery_status === 'SENDING'`, `'SENT'`, or `'DELIVERY_CONFIRMED'`: no error reason field shown
    - _Requirements: 6.7, 6.8, 6.9_

  - [ ]* 9.6 Write property test for error reason display conditionality
    - **Property 14: Error reason display is conditional on FAILED status**
    - **Validates: Requirements 6.9**
    - Write Vitest test in `frontend/src/components/alerts/AlertsPage.test.tsx`
    - Use fast-check to generate arbitrary `Alert` arrays with varying `delivery_status` values
    - Assert error reason element is present iff `delivery_status === 'FAILED'`; absent for all other values

  - [ ]* 9.7 Write property test for live mode zero counts
    - **Property 17: Live mode shows zeros for any empty backend response**
    - **Validates: Requirements 9.2, 9.3**
    - Write Vitest test in `frontend/src/App.test.tsx`
    - Render `<App>` with mocked services returning empty arrays and `VITE_DEMO_MODE` not set
    - Assert stat card values are `0` and no placeholder/fabricated values appear in the DOM

  - [ ] 9.8 Write backend pytest tests for alert_message_service and dispatch
    - Create `backend/tests/test_alert_message_service.py` with example-based tests:
      - GPS present: verify formatted string contains lat, lon, accuracy, ISO timestamp, confidence %
      - GPS absent: verify `"GPS: UNAVAILABLE"` appears and no lat/lon fields present
      - Confidence rounding: `0.9567` → `"95.7%"`
    - Add to `backend/tests/test_alert_dispatch.py`:
      - Dispatch 404: GET returns 404 for missing alert_id
      - Dispatch 409: second dispatch call on same alert returns 409
      - Dispatch flow: valid call sets `delivery_status="SENDING"` and returns `AlertResponse`
    - _Requirements: 6.1, 6.2, 5.1, 5.2, 5.3, 5.4_

  - [ ] 9.9 Final TypeScript and test verification
    - Run `cd frontend && npx tsc --noEmit` — zero errors required
    - Run `cd backend && python -m pytest tests/ -v` — all tests pass required
    - Fix any type errors or test failures before marking complete

- [ ] 10. Final checkpoint — All tests pass
  - Run `cd backend && python -m pytest tests/ -v` and confirm all pass
  - Run `cd frontend && npx tsc --noEmit` and confirm zero errors
  - Ask the user if any questions arise before closing out

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements for traceability
- Waves 1 and 3 are fully independent and can be executed in parallel; Wave 2 depends on Wave 1; Wave 4 depends on Wave 3; Wave 5 depends on Wave 4; Wave 6 depends on all prior waves
- Property tests use Hypothesis (backend) and fast-check (frontend); install with `pip install hypothesis` / `npm install --save-dev fast-check`
- The `DEMO_MODE` and `VITE_DEMO_MODE` env vars are not read by `pydantic-settings` — use `os.getenv` / `import.meta.env` directly
- Monitor.py changes (task 2.6) affect live alert creation — test with a live frame push after backend is running
- The `delivery_status` column is separate from the existing `status` column; both coexist on the same `alerts` table row

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "1.6"] },
    { "id": 1, "tasks": ["1.3", "1.5", "2.1", "2.3", "2.4", "2.5", "2.6", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.7", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "7.1", "7.2", "7.4", "7.6", "7.8", "7.9", "7.10"] },
    { "id": 5, "tasks": ["7.3", "7.5", "7.7", "9.1", "9.4", "9.5"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.6", "9.7", "9.8"] },
    { "id": 7, "tasks": ["9.9"] }
  ]
}
```
