# Implementation Plan: Aegis AI Dashboard

## Overview

This plan covers the full implementation of the Aegis AI Dashboard frontend integration, from fixing the initial 404 on "Connect Mobile Camera" through real-time camera status updates, live frame display, face recognition wiring, error handling, mock data removal, multi-adapter support, and end-to-end integration verification. Tasks are sequential with each phase building on the previous one.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4"] },
    { "wave": 5, "tasks": ["5"] },
    { "wave": 6, "tasks": ["6"] },
    { "wave": 7, "tasks": ["7"] },
    { "wave": 8, "tasks": ["8"] },
    { "wave": 9, "tasks": ["9"] },
    { "wave": 10, "tasks": ["10"] },
    { "wave": 11, "tasks": ["11"] },
    { "wave": 12, "tasks": ["12"] },
    { "wave": 13, "tasks": ["13"] },
    { "wave": 14, "tasks": ["14"] },
    { "wave": 15, "tasks": ["15"] },
    { "wave": 16, "tasks": ["16"] }
  ]
}
```

## Tasks

- [x] 1. Diagnose and fix the 404 on "Connect Mobile Camera"
  - Trace the exact button that triggers the 404. If "Connect Mobile Camera" appears outside `CamerasPage`, find where it calls the API and what `camera_id` it passes.
  - Add a "Connect Mobile Camera" button to the main dashboard `CameraGrid` empty-state view that goes through the full correct flow: `createCamera()` first → then `createMobileSession(camera.id)`.
  - Ensure `QRSessionPanel` always receives a valid `camera.id` from a created DB row before calling `createMobileSession`.
  - If `createCamera()` fails (backend down), show a meaningful error message instead of a 404.
  - Verify: clicking "Connect Mobile Camera" from the dashboard produces `201` from `POST /api/cameras` then `200` from `POST /api/mobile/sessions` with `session_id` and `connect_url` in the response. No 404.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/services/mobileService.ts`, `backend/app/api/mobile.py`, `backend/app/core/session_manager.py`
  - Acceptance: Clicking "Connect Mobile Camera" from any page never produces a 404; a session with a valid `session_id` and LAN-based `connect_url` is returned; QR code displays within 3 seconds; no unhandled console errors.

- [x] 2. Audit and consolidate the API client
  - Verify `api.ts` uses `import.meta.env.VITE_API_BASE_URL` exclusively — confirm no hardcoded `localhost:8000` or `127.0.0.1` scattered in components.
  - Fix `DebugPanel` in `CamerasPage.tsx`: replace raw `fetch` with `listMobileSessions()` from `mobileService.ts`.
  - Add `VITE_API_LAN_URL` to `.env` and `.env.example` so the QR code can use the LAN IP even if `VITE_API_BASE_URL` is `localhost`. Document that `VITE_API_LAN_URL` is auto-detected from backend `/api/network-info` at runtime and this env var is a fallback override.
  - In `mobileService.ts`, add `getNetworkInfo()` function calling `/api/network-info` and cache the result for 60 seconds.
  - Ensure all timeout / error interceptors in `api.ts` produce typed errors that components can distinguish (404 vs 500 vs network error).
  - Files affected: `frontend/src/services/api.ts`, `frontend/.env`, `frontend/.env.example`, `frontend/src/services/mobileService.ts`, `frontend/src/services/cameraService.ts`, `frontend/src/components/cameras/CamerasPage.tsx`
  - Acceptance: Zero occurrences of hardcoded IPs or ports outside `api.ts` and `.env` files; `DebugPanel` uses the service layer; `getNetworkInfo()` returns LAN IP, port, scheme; API errors have distinguishable types.

- [x] 3. Improve WebSocket real-time camera status updates
  - Handle `camera_session_update` WebSocket events in `useDashboardData.ts` — update camera status when `status` field changes (WAITING → CONNECTING → ONLINE → OFFLINE).
  - Export `wsConnected` from `useDashboardData` and display WebSocket connection state in the diagnostics panel.
  - Handle `webrtc_signal` events — relay them to the correct `RTCPeerConnection` if one exists for the session.
  - Reconnect WebSocket after server restart (already has 5s retry, but reset state to `wsConnected=false` while disconnected).
  - Add a `camera_session_update` handler that calls `refetch()` when a camera goes ONLINE so the camera list updates immediately.
  - Files affected: `frontend/src/hooks/useDashboardData.ts`, `frontend/src/App.tsx`
  - Acceptance: When a phone connects, dashboard camera status updates WAITING → CONNECTING → ONLINE within 3 seconds without manual refresh; `wsConnected` reflects actual state; WebSocket auto-reconnects after backend restarts.

- [x] 4. Zero-camera empty state — no fake cameras
  - Verify `CameraGrid` already shows "No cameras connected" when `cameras.length === 0` — add a "Connect Mobile Camera" quick-action button in the empty state.
  - Verify `StatCards` shows `0` for all counts when no backend data — test with actual backend running.
  - `SystemHealthPanel`: replace mock status strings with real data from `GET /api/system-health`. Show "Backend: ONLINE" or "Backend: OFFLINE". Remove any hardcoded "MOCK / DEV" strings.
  - Audit all components for any remaining mock values — camera counts, incident counts, detection counts. Replace with real API data or zero.
  - Files affected: `frontend/src/components/dashboard/CameraGrid.tsx`, `frontend/src/components/dashboard/StatCards.tsx`, `frontend/src/components/dashboard/SystemHealthPanel.tsx`
  - Acceptance: With no cameras and clean DB all stats show 0; `SystemHealthPanel` reflects real backend health; "No cameras connected" shows with a "Connect Mobile Camera" button.

- [x] 5. Fix the complete "Quick Connect Mobile" flow
  - The `handleQuickMobile()` flow in `CamerasPage.tsx` — confirm it correctly: creates camera → gets camera ID → passes to `QRSessionPanel` → creates session. If any step fails, show an error and do not leave an orphaned DB camera record.
  - Add cleanup: if the user cancels the QR panel, delete the auto-created camera (verify the cancel handler works).
  - Ensure `createCamera()` is called with meaningful auto-generated name like `Mobile ${new Date().toLocaleString()}` and location `Quick Connect`, not an empty string.
  - Add a "Connect Mobile Camera" button to the dashboard main view (`App.tsx` / `CameraGrid` empty state) that navigates to `CamerasPage` and triggers `handleQuickMobile()`.
  - Ensure clicking "Connect Mobile Camera" from the dashboard NEVER opens `navigator.mediaDevices.getUserMedia()` on the computer — only the phone should call getUserMedia.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/services/mobileService.ts`, `frontend/src/services/cameraService.ts`
  - Acceptance: "Connect Mobile Camera" from dashboard opens QR panel without any computer webcam prompt; session is created with a valid `session_id`; cancel cleans up the auto-created camera; no orphaned cameras in DB.

- [x] 6. QR code with correct LAN URL (not localhost)
  - Verify that `connect_url` returned by `POST /api/mobile/sessions` uses the LAN IP (e.g., `http://192.168.x.x:8000/mobile-camera?session=XXXX`), NOT `http://localhost:8000/...`. Confirm `get_lan_ip()` in `network.py` works correctly on Windows.
  - If `get_lan_ip()` returns `127.0.0.1` (fallback), add a warning in the QR panel: "⚠️ Server LAN IP could not be detected. Phone may not be able to connect. Ensure both devices are on the same Wi-Fi."
  - Add an "Override LAN IP" field in the QR panel (advanced/collapsible) that lets the user manually type the LAN IP if auto-detection fails.
  - Verify the QR panel shows the LAN IP in the URL text, not `localhost`.
  - The `connect_url` must always use the LAN IP for the QR code; the dashboard's API calls still use `VITE_API_BASE_URL` (localhost) — these are separate concerns.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `backend/app/api/mobile.py`, `backend/app/core/network.py`
  - Acceptance: QR code URL contains the server's LAN IP, never `localhost` or `127.0.0.1`; if LAN IP detection fails, a clear warning is shown with a manual override input; opening the QR URL on a phone loads the mobile camera page.

- [x] 7. Mobile camera page — validate and upgrade
  - Verify `GET /mobile-camera?session=XXXX` is served correctly by the backend. Test by opening the URL in a browser.
  - The current `mobile-camera.html` uses `location.host` for the server base URL — confirm this works with the actual backend port.
  - Verify `pingSession()` correctly calls `GET /api/mobile/sessions/{SESSION_ID}` before starting the camera.
  - Ensure camera permission prompt works on mobile browsers — `navigator.mediaDevices.getUserMedia()` is called with `{ facingMode: 'environment' }` for rear camera.
  - Verify frame pushing: the mobile page calls `POST /api/mobile/frame/{SESSION_ID}` at 10fps and the backend transitions session to ONLINE.
  - Add a "Re-scan QR" or "Session Expired" error state that shows when the session is invalid or expired, rather than a silent failure.
  - Ensure HTTPS compatibility: add a check that displays a warning if protocol mismatch is detected when TLS_ENABLED=true.
  - Files affected: `backend/app/static/mobile-camera.html`
  - Acceptance: Phone opens the mobile camera page; "Start Camera" prompts for camera permission; phone camera preview shows after permission granted; session transitions to ONLINE when first frame is pushed; dashboard receives the WebSocket event.

- [x] 8. Dashboard camera status cards update in real-time
  - When `camera_session_update` WebSocket event arrives with `status: 'ONLINE'`, the `CameraGrid` must immediately show the camera card with ONLINE status — no manual refresh needed.
  - Verify the WebSocket handler in `useDashboardData` updates `cameras` state when session status changes. `CameraPanel` must display the camera's real status from the `cameras` array.
  - Add session-status-to-camera-status mapping: when a session transitions to ONLINE, update the corresponding camera's `status` field in the cameras array using the `camera_id` from the event.
  - Health polling in `App.tsx` already polls every 3 seconds via `getAllCameraHealth()` — confirm this updates `peopleByCamera` correctly.
  - Status progression display: the dashboard should visually show WAITING → CONNECTING → ONLINE with appropriate colored badges during the connection flow.
  - Files affected: `frontend/src/components/dashboard/CameraGrid.tsx`, `frontend/src/components/dashboard/CameraPanel.tsx`, `frontend/src/hooks/useDashboardData.ts`
  - Acceptance: Camera card appears/updates in real-time when phone connects; status badges show WAITING=yellow, CONNECTING=blue, ONLINE=green, OFFLINE=gray; FPS and people-detected counts update every ~3 seconds; no manual refresh needed.

- [x] 9. Display real phone camera frames in the dashboard
  - Create a new endpoint: `GET /api/cameras/{camera_id}/snapshot` in `backend/app/api/cameras.py` that returns the latest frame buffer from the camera worker as a JPEG response.
  - In `CameraPanel.tsx`, when `camera.status === 'ONLINE'`, render an `<img>` tag that polls `GET /api/cameras/{camera_id}/snapshot` every 100ms (10fps) and updates the `src` attribute. Use object URLs to avoid memory leaks.
  - The snapshot polling must use `VITE_API_BASE_URL` base URL — never hardcoded.
  - Show FPS, resolution, and AI status overlaid on the video frame using health data.
  - When camera goes OFFLINE, stop snapshot polling and show "No Signal" state.
  - Files affected: `frontend/src/components/dashboard/CameraPanel.tsx`, `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/services/cameraService.ts`
  - Acceptance: Dashboard shows actual phone camera image when streaming; image updates at ~10fps; FPS counter reflects actual frame rate; no `navigator.mediaDevices.getUserMedia()` called on the computer.

- [x] 10. Wire face recognition results to the dashboard UI
  - Read `useFaceRecognition.ts` and `recognitionService.ts` — confirm they call real backend endpoints (`/api/recognition/...`). If they use mock data, replace with real API calls.
  - Add a handler in `useDashboardData.ts` for `detection` WebSocket events that include face recognition data.
  - `FaceRecognitionPage` must show real recognition events from the backend. Connect to `GET /api/detections` with `detection_type=face` filter.
  - When a face is recognized, display name (if known), confidence, camera, and timestamp.
  - "UNKNOWN" must be displayed when confidence is below threshold — never force a known identity.
  - Verify `face` is in `enabled_detectors` when creating the camera worker via `connectCamera()`.
  - Files affected: `frontend/src/components/recognition/FaceRecognitionPage.tsx`, `frontend/src/services/recognitionService.ts`, `frontend/src/hooks/useFaceRecognition.ts`, `frontend/src/hooks/useDashboardData.ts`
  - Acceptance: Face recognition events from real camera frames appear in `FaceRecognitionPage`; detection confidence is shown accurately; UNKNOWN identity shown when no match above threshold; no fake/mock recognition events.

- [x] 11. Connection diagnostics panel
  - Fix `DebugPanel` in `CamerasPage.tsx` to use `listMobileSessions()` service function instead of raw `fetch`.
  - Add backend connectivity status to the diagnostics panel: `GET /api/health` — show Backend: ONLINE/OFFLINE.
  - Show WebSocket connection state in the diagnostics panel using the `wsConnected` value from `useDashboardData`.
  - For each active session, show: session_id (truncated), camera name, device_type, status, frames_received, device_ip.
  - Add a "Network Info" section showing LAN IP, port, protocol from `/api/network-info`.
  - Add a "Copy Mobile URL" button that copies the LAN-based mobile camera URL to clipboard.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/hooks/useDashboardData.ts`, `frontend/src/components/layout/TopHeader.tsx`
  - Acceptance: Diagnostics panel shows real backend health data; active sessions listed with live frame counts; Backend: ONLINE/OFFLINE and WebSocket: CONNECTED/DISCONNECTED shown correctly.

- [x] 12. Replace generic error messages with actionable ones
  - Replace "Request failed with status code 404" with contextual messages. Verify `friendlyError()` is used everywhere, including the `QRSessionPanel` error display.
  - Add Retry and Cancel buttons wherever an error is shown in the QR panel flow.
  - Distinguish "Camera not found" 404 from "Session not found" 404 — show the correct message for each case.
  - When `createMobileSession` gets a 404 (camera_id not found), tell the user "Camera record not found — please re-register the camera."
  - When the backend is completely unreachable (network error), show "Cannot reach backend. Is the server running at {VITE_API_BASE_URL}?"
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/services/api.ts`
  - Acceptance: No raw HTTP status codes shown to user; every error has an actionable message; Retry button re-triggers the failed operation.

- [x] 13. Remove all remaining mock data
  - `StatCards.tsx` — verify it uses `summary` prop from `useDashboardData` (from `GET /api/dashboard/summary`). Confirm no hardcoded values.
  - `SystemHealthPanel.tsx` — verify it uses `systemHealth` from `useDashboardData`. Replace any hardcoded "MOCK / DEV" labels. Show "OFFLINE" with red indicator when service is not reachable.
  - `IncidentTimeline.tsx` — verify it renders real `incidents` prop. Replace any hardcoded timeline entries.
  - `FacilityMap.tsx` — update to use real `cameras` prop data. Camera markers should only appear for registered cameras.
  - `mockData.ts` — confirm it is already empty. Do not add anything here.
  - Search the entire `frontend/src` directory for hardcoded values like `"CAM-01"`, `"CAM-02"`, `"Possible Accident"`, `"4"` (fake camera count), `"94%"` (fake AI confidence). Replace all with real data or remove.
  - Files affected: `frontend/src/components/dashboard/StatCards.tsx`, `frontend/src/components/dashboard/SystemHealthPanel.tsx`, `frontend/src/components/dashboard/IncidentTimeline.tsx`, `frontend/src/components/dashboard/FacilityMap.tsx`, `frontend/src/mock/mockData.ts`
  - Acceptance: With clean database and no cameras all stats show 0; no hardcoded camera names, incident titles, or fake counts in components; `grep -r "CAM-0[1-4]" frontend/src/components` returns no results (except FacilityMap zone labels).

- [x] 14. Multi-adapter camera type support
  - `REMOTE_WEBRTC_ADAPTERS` and `RTSP_ADAPTERS` sets already define correct groupings. Verify that each adapter type routes to the correct connection flow (QR, RTSP form, or USB direct connect).
  - `browser_client` adapter — add instructions text: "Share this link with the second computer. It will open a camera page identical to the mobile page."
  - `drone` adapter — show RTSP URL field with placeholder `rtsp://drone-ip:554/stream`.
  - `usb` and `laptop_webcam` adapters — show a note: "The backend server will open the device directly. No browser camera is used."
  - None of these adapters should call `navigator.mediaDevices.getUserMedia()` on the dashboard.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`
  - Acceptance: Each adapter type shows appropriate UI; Mobile/WebRTC → QR code flow; RTSP/drone → URL input form; USB/webcam → direct server-side connect; no computer webcam prompt for any adapter type.

- [x] 15. Disconnect and reconnect flow
  - When user clicks "Disconnect" on a camera card, call `disconnectCamera(id)` and also `cancelMobileSession(sessionId)` if a session exists for that camera.
  - Get the session for a camera using `GET /api/mobile/sessions` filtered by `camera_id`. Add `getSessionForCamera(cameraId)` helper in `mobileService.ts`.
  - When phone disconnects (closes browser / kills app), the backend transitions session to OFFLINE. The `camera_session_update` WebSocket event with `status: 'OFFLINE'` should update the camera card.
  - Reconnect: add a "Reconnect" button that re-creates a session for the same camera and shows a new QR code.
  - Test: connect phone → disconnect → reconnect → camera returns to ONLINE.
  - Files affected: `frontend/src/components/cameras/CamerasPage.tsx`, `frontend/src/services/cameraService.ts`, `frontend/src/services/mobileService.ts`
  - Acceptance: Disconnect from dashboard stops phone streaming and shows OFFLINE; phone disconnect detected within 5 seconds via WebSocket; reconnect generates a new QR code and works from scratch; no stale session data after reconnection.

- [x] 16. End-to-end integration verification
  - Start backend: verify `GET /api/health` returns `{"status": "ok"}`.
  - Start frontend: verify dashboard loads, all stats show 0, no console errors.
  - Click "Connect Mobile Camera" from the main dashboard — verify no computer webcam opens, a real mobile session is created, and a QR code appears with a LAN IP URL.
  - Open the QR URL on a phone — verify the mobile camera page loads, requests camera permission, and shows the phone camera preview.
  - Click "Start Camera" on the phone — verify frames are pushed to `POST /api/mobile/frame/{session_id}`, session transitions to ONLINE, and dashboard updates WAITING → CONNECTING → ONLINE.
  - Verify dashboard shows the actual phone camera image (via snapshot polling or WebSocket frame relay).
  - Verify face detection runs on the frame (check backend logs for AI processing).
  - Close the phone browser tab — verify dashboard detects OFFLINE within 5 seconds.
  - Reconnect — verify the flow works again.
  - Connect a second device — verify two cameras appear independently.
  - Verify zero-camera state: disconnect all cameras, confirm all stats return to 0.
  - Run backend test suite: `cd backend && python -m pytest tests/ -v`.
  - Check browser console for any remaining errors. Fix all errors found.
  - Files affected: All above files, `backend/tests/`
  - Acceptance: All 13 test scenarios from the user's specification pass; no console errors during normal operation; backend logs show AI processing on real frames; `pytest` passes all existing backend tests.

## Notes

### Run Commands

#### Start the Backend
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Start the Frontend
```bash
cd frontend
npm run dev
```

#### Run Backend Tests
```bash
cd backend
python -m pytest tests/ -v
```

### Access Points
- **Dashboard**: http://localhost:5173 (or whatever port Vite uses)
- **Backend API docs**: http://localhost:8000/docs
- **Backend health**: http://localhost:8000/api/health
- **Network info** (LAN IP etc.): http://localhost:8000/api/network-info
- **Mobile camera page** (open on phone): `http://{LAN_IP}:8000/mobile-camera?session={SESSION_ID}`
