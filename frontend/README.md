# Cardiac Digital Twin — Frontend Architecture

This is the research frontend for the **Cardiac Digital Twin** project. It is built strictly inside `frontend/` without modifying any backend code, datasets, machine learning models, or root configurations.

---

## 1. Quick Start

### Step 1: Start the Existing FastAPI Backend
Open a PowerShell terminal and run:
```powershell
cd C:\CardiacDigitalTwin\backend
..\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env --reload
```
The backend API is now running at `http://127.0.0.1:8000`.

### Step 2: Start the Frontend Application
Open a second PowerShell terminal and run:
```powershell
$env:PATH = "C:\Users\Shaik Ayan Hyder\nodejs;" + $env:PATH
cd C:\CardiacDigitalTwin\frontend
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 2. Verification & Testing

To execute the automated unit and type tests:
```powershell
$env:PATH = "C:\Users\Shaik Ayan Hyder\nodejs;" + $env:PATH
cd C:\CardiacDigitalTwin\frontend

# Run unit tests on MIT-BIH presets and validators
npm test

# Run TypeScript type check and production bundle build
npm run build
```

---

## 3. Architecture & Features Implemented

1. **Public Landing Page**:
   - Modern hero section with real-time simulated demonstration Lead II trace canvas (360 Hz reference).
   - Clear distinction between illustrative waveforms and live telemetry hardware.
   - End-to-end workflow explanation (Biopotential amplification -> Wireless telemetry -> Feature extraction -> Model inference).
   - Instant Researcher Access and Google Sign-in.
   - Comprehensive biomedical investigational disclaimer.

2. **System & Research Overview Dashboard**:
   - Live telemetry querying `GET /health` and `GET /health/database`.
   - Real-time patient and observation counters.
   - Conceptual in-silico Digital Twin state representation.
   - Quick launch cards including instant access to the Cardiac Information Assistant.

3. **60 FPS Real-Time ECG Monitor**:
   - HTML5 Canvas renderer with sweep erase line running at 60 FPS.
   - Calibrated medical red/pink grid paper (25 mm/s sweep speed, 10 mm/mV gain).
   - Mode switcher: Live Hardware Sensor stream vs. prominently labeled Simulated Demonstration mode.
   - QRS sound toggle with synthesized Web Audio 880 Hz beep.

4. **234-Feature ML Prediction Studio**:
   - Direct integration with `POST /predict/heartbeat`.
   - 1-click authentic research presets from MIT-BIH Arrhythmia Database for classes N (Normal), S (SVEB), V (VEB), and Q (Paced).
   - Interactive heartbeat window visualizer (-0.25s pre-peak to +0.40s post-peak at 360 Hz).
   - Validation ensuring strictly 234 finite numerical values.
   - Posterior class probability bar visualization and non-clinical research badge.

5. **Cardiac Information Assistant (Chatbot)**:
   - Dedicated floating launcher and header integration for an educational and technical research companion.
   - Interactive queries on 234 temporal feature windows, AAMI beat classes (N, S, V, Q), Pan-Tompkins R-peak detector, and in silico digital twins.
   - Strictly medical-safety compliant: prominent disclaimers, clear refusal and emergency guidance for clinical diagnostic or prescription queries.

6. **Patient & Observation Registry**:
   - Lists registered subjects via `GET /patients` and logs observations via `GET /ecg-observations`.
   - Modals to create new patients (`POST /patients`) and add observations (`POST /ecg-observations`).

7. **Sensor Hardware & Bluetooth Telemetry**:
   - Clean, professional user interface ("Compatible ECG Sensor").
   - Modular Web Bluetooth adapter (`src/services/ble/adapter.ts`).
   - Collapsible Advanced Hardware Configuration section with technical pinouts, firmware specs, and customizable GATT UUIDs.

8. **Interactive Onboarding Mascot Guide ("Pulse")**:
   - Friendly biomedical animated pulse guide that introduces key platform sections.
   - Step-by-step walkthrough with keyboard navigation (Arrows & Escape).
   - Replay control in the header.

9. **PWA & Accessibility**:
   - Fully responsive design from 320px mobile screens to large desktop monitors.
   - Accessible slide-out mobile drawer with hamburger toggle.
   - Web App Manifest (`public/manifest.json`), custom SVG icon, and theme color metadata.

---

## 4. Firebase Configuration (Optional)

By default, the platform provides **Researcher Demo Sign-In** so you can test all features without requiring external cloud accounts.

To enable live Google Sign-In via Firebase:
1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Populate the Firebase project variables in `frontend/.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

---

## 5. Standalone CORS Deployment Note

In local development, `vite.config.ts` proxies `/api/*` to `http://127.0.0.1:8000/*` to avoid browser CORS issues without modifying backend code.

If you ever wish to deploy the frontend independently or connect directly to `http://127.0.0.1:8000`, the following 4 lines can be added to `backend/app/main.py` with your permission:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
*(As per project protection rules, this change has NOT been made to the backend; the Vite proxy handles connectivity seamlessly without touching backend files).*
