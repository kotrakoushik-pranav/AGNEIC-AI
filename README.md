# 🚁 Aegis AI — Autonomous AI-Powered Drone Search & Rescue

> **AI-powered autonomous drone system for faster, safer, and smarter disaster search and rescue.**

Aegis AI is an intelligent search-and-rescue platform designed to assist emergency response teams during disasters and hazardous situations.

The system combines **AI-based person detection, camera/thermal vision, GPS tracking, autonomous drone capabilities, real-time monitoring, alerts, and a centralized web dashboard** to help rescue teams locate survivors faster while reducing the risk to human responders.

---

## 🌍 Problem Statement

During disasters such as:

* Earthquakes
* Floods
* Landslides
* Building collapses
* Industrial accidents
* Forest emergencies
* Other hazardous environments

search-and-rescue teams often have to manually inspect large, dangerous, or difficult-to-access areas.

This can result in:

* ⏱️ Delayed survivor detection
* ⚠️ Increased risk to rescuers
* 🌫️ Difficulty operating in low-visibility environments
* 🗺️ Poor situational awareness
* 📍 Difficulty locating detected survivors
* 📡 Communication and coordination challenges

### The Goal

Build an intelligent system capable of performing initial aerial reconnaissance, detecting people, providing their approximate location, and presenting the information to rescue teams in real time.

---

# 💡 Proposed Solution

**Aegis AI** uses an AI-powered drone and a centralized command dashboard to support search-and-rescue operations.

The drone captures visual information from the disaster area and sends it to the processing system.

The AI analyzes the incoming camera data to identify people or potential survivors.

When a person is detected, the system can:

1. Detect the person using AI/computer vision.
2. Record the detection event.
3. Obtain location information through GPS.
4. Generate an alert.
5. Display the detection on the command dashboard.
6. Maintain incident/history information.
7. Help rescue teams understand the current situation.

### Core Concept

```text
        🚁 AI DRONE
             │
             │ Camera / Sensors
             ▼
      ┌───────────────┐
      │ AI Processing  │
      │ Person Detect  │
      └───────┬───────┘
              │
       Detection Event
              │
              ▼
      ┌───────────────┐
      │ Backend / DB   │
      │    Supabase    │
      └───────┬───────┘
              │
       Real-Time Data
              │
              ▼
      ┌───────────────┐
      │ Aegis Command  │
      │    Dashboard   │
      └───────┬───────┘
              │
       ┌──────┴──────┐
       ▼             ▼
    🚨 Alerts      🗺️ GPS
                   Location
```

---

# ✨ Key Features

## 🔐 Secure Authentication

* Email/password authentication
* Google Sign-In
* Supabase Authentication
* Protected dashboard access
* Operator account management

---

## 🚁 Drone & Camera Integration

Aegis AI is designed to connect cameras/devices used by the drone system to the command platform.

Planned/implemented capabilities include:

* Camera registration
* QR-based camera pairing
* Camera connection status
* Live camera feed
* Automatic reconnection
* Device management
* Camera disconnect detection

The dashboard is designed to avoid showing false camera information when no camera is connected.

---

## 🤖 AI Person Detection

The AI vision system is designed to analyze camera footage and identify people in disaster environments.

Potential detection sources include:

* RGB camera
* Thermal camera
* Computer vision models
* AI-based object/person detection

Detected people can generate events that are displayed in the command dashboard.

---

## 🗺️ GPS Location Tracking

The system includes GPS-based location functionality for providing geographical context to detections.

GPS information can be used to:

* Display drone position
* Track detected locations
* Show locations on a map
* Maintain location history
* Assist rescue-team coordination

For prototype demonstrations, the GPS functionality can provide map-based positioning even when operating with simulated/demo coordinates.

---

## 🚨 Real-Time Alerts

When an important event occurs, the system can generate alerts such as:

* Person detected
* Possible survivor detected
* Camera connected
* Camera disconnected
* Device status changes
* Important system events

Alerts are intended to help operators quickly identify situations requiring attention.

---

## 📊 Command Dashboard

The Aegis command center provides a centralized interface for monitoring the rescue operation.

The dashboard can contain:

* 📹 Live camera feed
* 👤 Detected people
* 🚨 Active alerts
* 🗺️ GPS map
* 🚁 Drone/device status
* 📍 Detection locations
* 📜 Incident history
* 📷 Registered cameras
* 👥 Operator information

---

## 🗃️ Persistent Data

Supabase is used to provide cloud-backed persistence.

The system can maintain information such as:

* User accounts
* Camera/device records
* Incidents
* Alerts
* Person detection records
* GPS/location history
* Dashboard history

This allows information to remain available across sessions and potentially across multiple computers.

---

# 🏗️ System Architecture

```text
                         ┌────────────────────┐
                         │      AI Drone      │
                         │                    │
                         │ Camera + GPS       │
                         │ Sensors            │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Camera Stream    │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │  AI / CV Engine    │
                         │                    │
                         │ Person Detection   │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Backend Layer    │
                         │                    │
                         │ Detection Events   │
                         │ GPS Data           │
                         │ Device Status      │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │      Supabase      │
                         │                    │
                         │ Authentication     │
                         │ Database           │
                         │ Realtime           │
                         └─────────┬──────────┘
                                   │
                                   ▼
                  ┌────────────────────────────────┐
                  │       Aegis Command Center     │
                  │                                │
                  │ Dashboard                      │
                  │ Map                            │
                  │ Alerts                         │
                  │ Camera                         │
                  │ Incidents                      │
                  └────────────────────────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

* **React**
* **TypeScript**
* **Vite**
* **HTML5**
* **CSS**
* **JavaScript / TypeScript**

## Backend / Cloud

* **Supabase**
* Supabase Authentication
* Supabase Database
* Supabase Realtime

## AI / Computer Vision

* Computer Vision
* Person Detection
* Object Detection
* RGB Vision
* Thermal Vision support

## Hardware

* Autonomous Drone
* Camera
* GPS Module
* Obstacle Detection Sensors
* Flight Controller
* Communication Module

## Development Tools

* Git
* GitHub
* VS Code / Kiro
* Node.js
* npm

---

# 📁 Project Structure

A typical project structure is:

```text
Aegis-AI/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── App.tsx
│   │
│   ├── public/
│   ├── .env
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   └── ...
│
├── ai/
│   └── ...
│
├── hardware/
│   └── ...
│
├── README.md
└── .gitignore
```

> The exact structure may vary depending on the implementation.

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
```

Move into the project:

```bash
cd YOUR_REPOSITORY
```

---

## 2. Install Dependencies

Navigate to the frontend:

```bash
cd frontend
```

Install packages:

```bash
npm install
```

---

# 🔐 Supabase Configuration

Aegis AI uses Supabase for authentication and persistent cloud data.

Create a Supabase project and obtain:

* Supabase Project URL
* Supabase Anon/Public Key

Create:

```text
frontend/.env
```

Add:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### Important

Do **not** commit your `.env` file to GitHub.

Add this to `.gitignore`:

```gitignore
.env
.env.local
.env.*.local
```

---

# 🔑 Google Authentication

Aegis AI supports Google Sign-In through Supabase Authentication.

The general flow is:

```text
User
 │
 ▼
Aegis Login
 │
 ▼
Supabase Auth
 │
 ▼
Google
 │
 ▼
Authentication
 │
 ▼
Aegis Dashboard
```

The Google provider must be configured in the Supabase Authentication settings, including the required OAuth credentials and redirect configuration.

---

# ▶️ Running the Application

From the `frontend` directory:

```bash
npm run dev
```

Vite will provide a local development address, normally similar to:

```text
http://localhost:5173
```

Open the displayed address in your browser.

---

# 📹 Camera Workflow

The intended camera workflow is:

```text
Camera
   │
   ▼
Generate / Display QR Pairing
   │
   ▼
Scan QR
   │
   ▼
Register Camera
   │
   ▼
Establish Connection
   │
   ▼
Show Connection Status
   │
   ▼
Start Live Feed
   │
   ▼
AI Person Detection
```

The application should clearly distinguish between:

* Connected camera
* Connecting camera
* Disconnected camera
* Camera unavailable

The dashboard should not display fabricated camera statistics, detections, or historical alerts when there is no connected device.

---

# 🗺️ GPS Workflow

```text
GPS Module
    │
    ▼
Latitude + Longitude
    │
    ▼
Backend
    │
    ▼
Database
    │
    ▼
Command Dashboard
    │
    ▼
Map Marker
```

For demonstration purposes, simulated GPS coordinates may be used when physical GPS hardware is unavailable.

---

# 🚨 Incident Workflow

```text
AI Detects Person
        │
        ▼
Create Detection Event
        │
        ▼
Capture Location
        │
        ▼
Store Incident
        │
        ▼
Generate Alert
        │
        ▼
Display on Dashboard
        │
        ▼
Rescue Team Response
```

---

# 🧠 AI Detection Pipeline

The intended AI pipeline is:

```text
Camera Frame
     │
     ▼
Pre-processing
     │
     ▼
AI Model
     │
     ▼
Person Detection
     │
     ▼
Confidence Check
     │
     ▼
Detection Event
     │
     ├──────────────► GPS Location
     │
     └──────────────► Alert
                         │
                         ▼
                    Dashboard
```

The AI layer can be extended with models suitable for real-time object/person detection.

---

# 🔒 Security Considerations

Because the platform deals with operational and potentially sensitive information, security is important.

Recommended practices include:

* Never expose private API keys in frontend code.
* Never commit `.env` files.
* Use Supabase Row Level Security where appropriate.
* Validate authenticated users.
* Protect database operations.
* Validate camera/device pairing requests.
* Validate incoming detection data.
* Use HTTPS for production deployments.
* Restrict access to operational dashboards.

---

# 🧪 Development & Testing

Before deployment, verify:

### Authentication

* [ ] Email sign-up works
* [ ] Email login works
* [ ] Google login works
* [ ] Logout works
* [ ] Protected pages require authentication

### Camera

* [ ] Camera registration works
* [ ] QR pairing works
* [ ] Camera connection is detected
* [ ] Live feed works
* [ ] Disconnect is detected
* [ ] Automatic reconnection works

### AI

* [ ] Person detection works
* [ ] Detection events are recorded
* [ ] False dashboard statistics are avoided
* [ ] Confidence handling works

### GPS

* [ ] GPS coordinates are received
* [ ] Map loads correctly
* [ ] Location marker is displayed
* [ ] Location history is stored

### Database

* [ ] Incidents persist
* [ ] Alerts persist
* [ ] Camera records persist
* [ ] Person records persist
* [ ] Data synchronizes correctly

---

# 🎯 Expected Impact

Aegis AI is designed to support emergency response by:

### ⚡ Faster Search

AI-assisted aerial reconnaissance can help scan large areas more efficiently.

### 🛡️ Reduced Risk

Initial reconnaissance can be performed before human rescuers enter potentially dangerous areas.

### 👤 Earlier Detection

Computer vision can assist in identifying people in challenging environments.

### 🗺️ Better Situational Awareness

GPS and live visual information provide rescue teams with geographical and visual context.

### 🚨 Improved Coordination

Centralized alerts and incident information can help operators organize rescue activities.

---

# 🚀 Future Development

Potential future improvements include:

* Fully autonomous flight planning
* Advanced obstacle avoidance
* Multi-drone coordination
* Thermal survivor detection
* Improved AI detection models
* Human pose estimation
* Survivor prioritization
* Voice alerts
* Offline operation
* Edge AI processing
* 5G communication
* Mesh networking between drones
* Automated disaster-zone mapping
* Advanced mission planning
* Real-time drone telemetry
* Multiple simultaneous camera feeds
* Digital elevation and 3D mapping

---

# 🌟 Innovation

The core idea behind Aegis AI is to combine several technologies into a unified rescue platform:

```text
             ┌──────────────┐
             │   AI Vision  │
             └──────┬───────┘
                    │
┌──────────┐   ┌────▼─────┐   ┌──────────┐
│   GPS    │──►│ AEGIS AI │◄──│  Drone   │
└──────────┘   └────┬─────┘   └──────────┘
                    │
             ┌──────▼──────┐
             │   Alerts    │
             └──────┬──────┘
                    │
             ┌──────▼──────┐
             │   Command   │
             │   Center    │
             └─────────────┘
```

Instead of treating the drone, AI detection, GPS, alerts, and monitoring dashboard as separate systems, Aegis AI brings them together into one command platform.

---

# 📌 Project Status

**Current Stage:** 🚧 Prototype / Active Development

The project is being developed as an AI-powered autonomous search-and-rescue prototype.

Core development areas include:

* [x] Web dashboard
* [x] Supabase integration
* [x] Authentication architecture
* [x] Google authentication setup
* [x] Camera management architecture
* [x] GPS/map interface
* [ ] Complete camera pairing
* [ ] Production live camera streaming
* [ ] AI detection integration
* [ ] Full hardware integration
* [ ] Autonomous flight control
* [ ] Production deployment

---

# 👨‍💻 Project Team

**Aegis AI — AI-Powered Autonomous Drone Search & Rescue**

Built as an innovative prototype for intelligent disaster-response and search-and-rescue applications.

---

# 📄 License

This project is currently intended for educational, research, demonstration, and prototype development purposes.

Add an appropriate open-source license to this repository if you plan to distribute the project publicly.

---

# ⭐ Support the Project

If you find the project interesting:

⭐ Star the repository
🍴 Fork the project
🐛 Report issues
💡 Suggest improvements
🤝 Contribute to development

---

## 🚁 Aegis AI

**Search smarter. Respond faster. Reduce risk.**

> *AI-powered aerial intelligence for the next generation of search and rescue.*
