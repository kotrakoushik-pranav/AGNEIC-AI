# Requirements Document

## Introduction

Aegis AI is a local smart-safety dashboard built on FastAPI (port 8000) and React/TypeScript/Vite (port 5173). The backend stores data in SQLite and exposes a WebSocket at `ws://localhost:8000/ws`. Mobile cameras connect via QR-code frame-push. The existing codebase handles camera management, AI detection, incident tracking, and basic alert recording.

This document specifies the requirements to complete the Aegis AI dashboard into a fully working, production-quality local application. The work covers nine areas: startup reliability, GPS/geolocation, emergency alert confirmation, configurable response destinations, alert message formatting, real delivery status tracking, a global system-status panel, application startup checks, and elimination of all fake/demo data from live mode.

---

## Glossary

- **Dashboard**: The React/TypeScript/Vite frontend application running at `http://localhost:5173`.
- **Backend**: The FastAPI/Python application running at `http://localhost:8000`.
- **Health_Check**: The initial HTTP probe the Dashboard sends to `GET /api/health` on startup to determine whether the Backend is reachable.
- **Backend_Offline_Screen**: A full-page UI component rendered by the Dashboard when the Backend is unreachable.
- **Retry_Button**: An interactive element on the Backend_Offline_Screen that re-executes the Health_Check.
- **GPS_Service**: The browser-side module that wraps the Geolocation API and manages permission state.
- **GPS_Panel**: The Dashboard UI component that displays the current GPS permission state and captured coordinates.
- **GPS_Status**: One of four values — `AVAILABLE`, `PERMISSION_REQUIRED`, `UNAVAILABLE`, or `DENIED`.
- **Incident**: A threat event detected by the AI engine and stored in the Backend database.
- **Alert**: A notification record linked to an Incident that can be dispatched to an external destination.
- **Alert_Confirmation_Modal**: The Dashboard UI component that presents pending Alert details to the operator before dispatch.
- **Alert_Dispatch**: The act of the Dashboard calling the Backend's send endpoint after operator confirmation.
- **Delivery_Status**: One of four terminal/in-progress values — `SENDING`, `SENT`, `DELIVERY_CONFIRMED`, or `FAILED`.
- **Destination**: An externally-configured emergency contact endpoint (URL, phone number, or API key) stored in the Backend `.env` file.
- **Destination_Category**: One of five labels — `Medical`, `Fire/Rescue`, `Police`, `Disaster_Response`, or `Local_Emergency`.
- **Alert_Message**: The structured text payload sent to an external Destination, formatted as an AEGIS-AI EMERGENCY ALERT.
- **System_Status_Panel**: The Dashboard UI component that shows real-time status for each monitored subsystem.
- **Subsystem**: One of six monitored components — `Backend`, `Camera`, `WebSocket`, `GPS`, `AI_Engine`, or `Alert_Service`.
- **Startup_Check**: The sequence of probes the Dashboard runs on initial load to determine the status of every Subsystem.
- **DEMO_MODE**: A backend environment variable (`DEMO_MODE=true`) that enables seeded/simulated data. Default is `false`.
- **Live_Mode**: The default operating mode when `DEMO_MODE` is not set or is `false`; no fake data is injected.
- **Operator**: The human user monitoring the Dashboard.

---

## Requirements

### Requirement 1: Startup Reliability and Backend Offline Detection

**User Story:** As an Operator, I want the Dashboard to detect when the Backend is unreachable at startup and show a clear offline screen instead of a blank page, so that I know immediately why the application is not working.

#### Acceptance Criteria

1. WHEN the Dashboard application loads, THE Dashboard SHALL send an HTTP GET request to `GET /api/health` before rendering any data-dependent UI.
2. IF the Health_Check request fails, cannot be sent (including due to network or DNS failure), or returns a non-2xx status within 5 seconds, THEN THE Dashboard SHALL render the Backend_Offline_Screen and SHALL NOT render the main dashboard layout.
3. THE Backend_Offline_Screen SHALL display the text "BACKEND OFFLINE" in a visible, high-contrast style.
4. THE Backend_Offline_Screen SHALL display a human-readable explanation that the Backend at `http://localhost:8000` could not be reached.
5. THE Backend_Offline_Screen SHALL render the Retry_Button labeled "RETRY CONNECTION".
6. WHEN the Operator clicks the Retry_Button, THE Dashboard SHALL re-execute the Health_Check.
7. WHEN a Health_Check succeeds after the Backend_Offline_Screen is displayed, THE Dashboard SHALL transition from the Backend_Offline_Screen to the main dashboard layout without requiring a full page reload.
8. WHILE a Health_Check request is in progress, THE Dashboard SHALL display a loading indicator and SHALL disable the Retry_Button to prevent duplicate requests.
9. IF the Backend transitions from reachable to unreachable after initial load, THEN THE Dashboard SHALL display the existing error banner with text "BACKEND CONNECTION LOST", SHALL retain the last known state rather than showing blank data, and SHALL remain on the main dashboard layout.

---

### Requirement 2: GPS / Geolocation Integration

**User Story:** As an Operator, I want the Dashboard to capture the device's GPS coordinates with explicit permission, so that emergency alerts include accurate location data.

#### Acceptance Criteria

1. THE GPS_Service SHALL expose four GPS_Status values: `AVAILABLE`, `PERMISSION_REQUIRED`, `UNAVAILABLE`, and `DENIED`.
2. WHEN the Dashboard initialises, THE GPS_Service SHALL read the browser's Permission API to determine the current geolocation permission state without triggering a permission prompt.
3. WHEN the GPS permission state is `prompt`, THE GPS_Service SHALL set GPS_Status to `PERMISSION_REQUIRED`.
4. WHEN the GPS permission state is `denied`, THE GPS_Service SHALL set GPS_Status to `DENIED`.
5. WHEN the GPS permission state is `granted`, THE GPS_Service SHALL call `navigator.geolocation.watchPosition` and SHALL set GPS_Status to `AVAILABLE` only after receiving the first valid position fix from the API.
6. IF the browser does not support the Geolocation API, THEN THE GPS_Service SHALL set GPS_Status to `UNAVAILABLE` and SHALL NOT attempt to access `navigator.geolocation`.
7. THE GPS_Panel SHALL be visible on the Dashboard at all times.
8. WHEN GPS_Status is `PERMISSION_REQUIRED`, THE GPS_Panel SHALL display an "ENABLE LOCATION" button.
9. WHEN the Operator clicks the "ENABLE LOCATION" button, THE GPS_Service SHALL call `navigator.geolocation.getCurrentPosition`, which triggers the browser's native permission prompt.
10. WHEN GPS_Status is `AVAILABLE`, THE GPS_Panel SHALL display the current latitude, longitude, accuracy in metres, and the timestamp of the last fix.
11. WHEN GPS_Status is `DENIED`, THE GPS_Panel SHALL display "Location access denied" and SHALL NOT display the "ENABLE LOCATION" button.
12. WHEN GPS_Status is `UNAVAILABLE`, THE GPS_Panel SHALL display "Geolocation not supported by this browser".
13. THE GPS_Service SHALL NEVER store or transmit fabricated coordinates; all coordinate values SHALL originate from `navigator.geolocation` responses.
14. WHEN GPS_Status is `AVAILABLE`, THE GPS_Service SHALL update stored coordinates on every position event received from `navigator.geolocation.watchPosition`.

---

### Requirement 3: Emergency Alert Confirmation Flow

**User Story:** As an Operator, I want to review and explicitly approve every emergency alert before it is dispatched, so that no alert is ever sent without my knowledge.

#### Acceptance Criteria

1. WHEN the AI engine creates an Incident with severity `CRITICAL` or `HIGH`, THE Backend SHALL create an Alert record with status `PENDING_REVIEW` and SHALL broadcast an `alert_pending` WebSocket event to all connected Dashboard clients.
2. WHEN the Dashboard receives an `alert_pending` WebSocket event, THE Dashboard SHALL display the Alert_Confirmation_Modal.
3. THE Alert_Confirmation_Modal SHALL display the incident type, source camera name, detection timestamp, AI confidence score, and severity of the associated Incident.
4. WHEN GPS_Status is `AVAILABLE`, THE Alert_Confirmation_Modal SHALL display the current GPS coordinates.
5. WHEN GPS_Status is not `AVAILABLE`, THE Alert_Confirmation_Modal SHALL always display "Location unavailable" in place of GPS coordinates.
6. THE Alert_Confirmation_Modal SHALL display a preview of the configured Destination(s) the Alert will be sent to.
7. THE Alert_Confirmation_Modal SHALL contain a "SEND" button and a "DISMISS" button.
8. THE Dashboard SHALL NOT call the Backend alert dispatch endpoint until the Operator clicks "SEND".
9. WHEN the Operator clicks "SEND", THE Dashboard SHALL call `POST /api/alerts/{alert_id}/dispatch` and SHALL immediately set the Delivery_Status to `SENDING`.
10. WHEN the Operator clicks "DISMISS", THE Dashboard SHALL call `PATCH /api/alerts/{alert_id}/acknowledge` and SHALL close the Alert_Confirmation_Modal without dispatching the Alert.
11. THE Alert_Confirmation_Modal SHALL remain open and interactive at all times until the Operator takes an explicit action (SEND or DISMISS); any state in which the modal becomes unresponsive is a defect.
12. IF a second `alert_pending` event arrives while the Alert_Confirmation_Modal is open, THEN THE Dashboard SHALL queue the new Alert and SHALL display a pending-alerts count indicator.

---

### Requirement 4: Configurable Emergency Response Destinations

**User Story:** As an Administrator, I want to configure emergency contact endpoints via the backend `.env` file so that alert destinations are never hardcoded and credentials are kept secure.

#### Acceptance Criteria

1. THE Backend SHALL read Destination configuration exclusively from environment variables defined in the `.env` file and SHALL NOT hardcode any phone numbers, URLs, or API keys in source code.
2. THE Backend SHALL support five Destination_Categories: `Medical`, `Fire/Rescue`, `Police`, `Disaster_Response`, and `Local_Emergency`.
3. FOR each Destination_Category, THE Backend SHALL read a corresponding endpoint URL or phone number from a dedicated environment variable (e.g., `ALERT_DEST_MEDICAL`, `ALERT_DEST_FIRE`, `ALERT_DEST_POLICE`, `ALERT_DEST_DISASTER`, `ALERT_DEST_LOCAL`).
4. FOR each Destination_Category that requires API authentication, THE Backend SHALL read credentials from a dedicated environment variable (e.g., `ALERT_KEY_MEDICAL`, `ALERT_KEY_FIRE`).
5. THE Backend SHALL expose `GET /api/alert-destinations` returning a list of Destination_Categories with their configured status (`CONFIGURED` or `NOT_CONFIGURED`) and SHALL NOT include credential values in the response.
6. WHEN a Destination_Category environment variable is not set or is empty, THE Backend SHALL report that Destination as `NOT_CONFIGURED`.
7. THE Dashboard SHALL display the configured status of each Destination_Category in the Alert_Confirmation_Modal Destination preview.
8. WHEN a Destination is `NOT_CONFIGURED`, THE Alert_Confirmation_Modal SHALL display "NOT CONFIGURED" for that Destination_Category and SHALL exclude it from dispatch.
9. THE Dashboard SHALL provide an admin settings view listing all five Destination_Categories with their `CONFIGURED` or `NOT_CONFIGURED` status.

---

### Requirement 5: Structured Alert Message Format

**User Story:** As an Operator, I want every dispatched alert to use a standardised message format so that responding agencies receive clear, consistent information.

#### Acceptance Criteria

1. THE Backend SHALL format every dispatched Alert as an AEGIS-AI EMERGENCY ALERT message containing: alert identifier, incident type, source camera name, detection timestamp in ISO 8601 format, AI confidence score as a percentage, GPS coordinates (if available), and severity level.
2. WHEN GPS coordinates are available at dispatch time, THE Backend SHALL include latitude, longitude, and accuracy in the Alert_Message.
3. WHEN GPS coordinates are not available at dispatch time, THE Backend SHALL include the literal string "GPS: UNAVAILABLE" in the Alert_Message.
4. THE Alert_Message SHALL include a section header "AEGIS-AI EMERGENCY ALERT" as the first line of the message body.
5. THE Backend SHALL generate the Alert_Message at real-time dispatch, using data from the Alert and Incident records at the moment `POST /api/alerts/{alert_id}/dispatch` is called, and SHALL NOT accept pre-generated or free-text message bodies from the Dashboard.
6. THE Alert_Confirmation_Modal SHALL render a read-only preview of the exact Alert_Message that will be sent before the Operator clicks "SEND". IF the preview fails to render, THEN THE Dashboard SHALL disable the "SEND" button and SHALL display an error message.

---

### Requirement 6: Real Delivery Status Tracking

**User Story:** As an Operator, I want to see the true delivery status of every dispatched alert so that I know whether emergency services have been successfully notified.

#### Acceptance Criteria

1. THE Backend SHALL track Delivery_Status for every dispatched Alert using four values: `SENDING`, `SENT`, `DELIVERY_CONFIRMED`, and `FAILED`.
2. WHEN `POST /api/alerts/{alert_id}/dispatch` is called, THE Backend SHALL set Delivery_Status to `SENDING` and SHALL initiate the external delivery attempt.
3. WHEN the external delivery attempt returns a success response, THE Backend SHALL set Delivery_Status to `SENT` and SHALL broadcast an `alert_status_updated` WebSocket event.
4. WHEN the external delivery attempt returns an error response or times out after 30 seconds, THE Backend SHALL set Delivery_Status to `FAILED`, SHALL record the error reason, and SHALL broadcast an `alert_status_updated` WebSocket event.
5. THE Backend SHALL NEVER set Delivery_Status to `SENT` or `DELIVERY_CONFIRMED` unless the external endpoint returned an explicit success response.
6. WHEN an external delivery service provides a delivery confirmation callback, THE Backend SHALL set Delivery_Status to `DELIVERY_CONFIRMED` and SHALL broadcast an `alert_status_updated` WebSocket event.
7. THE Dashboard SHALL display the current Delivery_Status for each dispatched Alert on the Alerts page.
8. WHEN the Dashboard receives an `alert_status_updated` WebSocket event, THE Dashboard SHALL update the displayed Delivery_Status for the affected Alert without requiring a page reload.
9. WHEN Delivery_Status is `FAILED`, THE Dashboard SHALL display the error reason returned by the Backend alongside the status. WHEN Delivery_Status is `SENDING`, `SENT`, or `DELIVERY_CONFIRMED`, THE Dashboard SHALL NOT display an error reason field.

---

### Requirement 7: Global System Status Panel

**User Story:** As an Operator, I want a single status panel showing the real-time health of all six subsystems so that I can immediately diagnose any operational issue.

#### Acceptance Criteria

1. THE System_Status_Panel SHALL display the status of exactly six Subsystems: `Backend`, `Camera`, `WebSocket`, `GPS`, `AI_Engine`, and `Alert_Service`.
2. THE System_Status_Panel SHALL be visible on the main Dashboard page at all times without requiring navigation.
3. WHEN the Backend responds to `GET /api/health` with a 2xx status, THE System_Status_Panel SHALL display the `Backend` Subsystem as `ONLINE`.
4. WHEN the Backend `GET /api/health` request fails, THE System_Status_Panel SHALL display the `Backend` Subsystem as `OFFLINE`.
5. WHEN the WebSocket connection state is `OPEN`, THE System_Status_Panel SHALL display the `WebSocket` Subsystem as `CONNECTED`.
6. WHEN the WebSocket connection state is not `OPEN`, THE System_Status_Panel SHALL display the `WebSocket` Subsystem as `DISCONNECTED`.
7. WHEN at least one Camera has status `ONLINE` in the Dashboard camera list, THE System_Status_Panel SHALL display the `Camera` Subsystem as `ONLINE`.
8. WHEN no Camera has status `ONLINE`, THE System_Status_Panel SHALL display the `Camera` Subsystem as `OFFLINE`.
9. THE System_Status_Panel SHALL display the `GPS` Subsystem using the current GPS_Status value from the GPS_Service.
10. WHEN the Backend `GET /api/health` response includes `"face_engine": "ready"`, THE System_Status_Panel SHALL display the `AI_Engine` Subsystem as `READY`.
11. WHEN the Backend `GET /api/health` response does not include `"face_engine": "ready"`, THE System_Status_Panel SHALL display the `AI_Engine` Subsystem as `LOADING` or `UNAVAILABLE` based on the returned value.
12. WHEN at least one Destination_Category is `CONFIGURED`, THE System_Status_Panel SHALL display the `Alert_Service` Subsystem as `CONFIGURED`.
13. WHEN no Destination_Category is `CONFIGURED`, THE System_Status_Panel SHALL display the `Alert_Service` Subsystem as `NOT CONFIGURED`.
14. ALL status values displayed in the System_Status_Panel SHALL be derived from real API responses, WebSocket state, or GPS_Service state, and SHALL NOT be hardcoded or randomly generated.

---

### Requirement 8: Application Startup Check Sequence

**User Story:** As an Operator, I want the Dashboard to run a complete health check on all subsystems when it first loads so that I always see current system state from the moment I open the application.

#### Acceptance Criteria

1. WHEN the Dashboard application loads, THE Dashboard SHALL execute the Startup_Check sequence before rendering data-dependent components.
2. THE Startup_Check sequence SHALL probe the following concurrently, with no enforced ordering or initial state: `GET /api/health` for Backend status, a WebSocket connection attempt for WebSocket status, `GET /api/cameras` for Camera status, `GET /api/health` body parsing for AI_Engine status, `GET /api/alert-destinations` for Alert_Service status, and the browser Permission API for GPS status.
3. THE Dashboard SHALL display a loading state for each Subsystem that has not yet returned a result during Startup_Check.
4. WHEN all Startup_Check probes have completed or timed out (maximum 10 seconds per probe), THE Dashboard SHALL update the System_Status_Panel with results and proceed to render the main layout.
5. IF the Backend probe fails during Startup_Check, THEN THE Dashboard SHALL render the Backend_Offline_Screen and SHALL NOT proceed to the main layout.
6. IF any non-Backend probe fails during Startup_Check, THEN THE Dashboard SHALL proceed to the main layout and SHALL display the affected Subsystem as `OFFLINE` or its equivalent error state in the System_Status_Panel.
7. THE Startup_Check sequence SHALL complete within 15 seconds regardless of individual probe results; any probe that has not responded within 10 seconds SHALL be marked as its error state.

---

### Requirement 9: No Fake Data in Live Mode

**User Story:** As an Operator, I want the application to display only real data in Live Mode so that I can trust every value shown on the Dashboard reflects actual system state.

#### Acceptance Criteria

1. THE Dashboard SHALL default to Live_Mode when the `VITE_DEMO_MODE` environment variable is absent or set to any value other than `"true"`.
2. WHILE in Live_Mode, THE Dashboard SHALL NOT render any hardcoded, randomly generated, or seeded metric values in stat cards, camera feeds, incident lists, or system health indicators.
3. WHILE in Live_Mode, THE Dashboard SHALL display zero counts (0 cameras online, 0 incidents, 0 detections) when the Backend returns empty collections, and SHALL NOT substitute placeholder numbers.
4. THE Backend SHALL default to Live_Mode when the `DEMO_MODE` environment variable is absent or set to `"false"`.
5. WHILE the Backend is in Live_Mode, THE Backend SHALL NOT insert seeded incidents, alerts, or camera sessions into the database.
6. WHERE `DEMO_MODE=true` is set in the Backend `.env` file, THE Backend SHALL permit seeded/demo data via the `seed.py` script.
7. WHERE `VITE_DEMO_MODE=true` is set in the frontend `.env` file, THE Dashboard SHALL display a persistent "DEMO MODE" banner so that the Operator is never unaware that the displayed data is simulated.
8. THE Backend `.env.example` and frontend `.env.example` files SHALL document the `DEMO_MODE` and `VITE_DEMO_MODE` variables with clear descriptions of their effect.
