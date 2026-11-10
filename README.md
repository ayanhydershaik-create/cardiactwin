# Cardiac Digital Twin

A research-grade real-time cardiac telemetry and digital twin analysis platform.

Streams single-lead ECG biopotential signals wirelessly from a custom ESP32-S3 hardware sensor, renders medical-grade waveforms in the browser, and classifies individual heartbeats using a machine-learning model trained on the MIT-BIH Arrhythmia Database.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **Backend** | FastAPI (Python 3.12), Uvicorn |
| **Authentication** | Firebase Authentication (Google OAuth + Email/Password) |
| **Database** | PostgreSQL 17 (Docker locally, Neon in production) |
| **ML / ECG Prediction** | Scikit-learn Random Forest, 234 MIT-BIH features |
| **Agentic AI** | Google Gemini (via `google-genai` SDK) |
| **Hardware Sensor** | ESP32-S3 + AD8232 ECG AFE, BLE GATT streaming |
| **Wireless Protocol** | Web Bluetooth (W3C), BLE GATT Notify |

---

## Architecture

```
User Browser
    │
    ▼
Vercel (React Frontend)  ◄──── Firebase Auth (Google / Email)
    │
    ▼
Render (FastAPI Backend + Random Forest ML Model)
    │
    ▼
Neon Managed PostgreSQL  (Patient records, ECG observations, AI activities)
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Python 3.12+
- Docker Desktop
- Google Chrome or Edge (for Web Bluetooth)

### 1. Clone the repository

```bash
git clone https://github.com/ayanhydershaik-create/cardiactwin.git
cd cardiactwin
```

### 2. Start PostgreSQL via Docker

```bash
docker run -d \
  --name cardiac-postgres \
  -e POSTGRES_USER=cardiac_admin \
  -e POSTGRES_PASSWORD=your_password_here \
  -e POSTGRES_DB=cardiac_twin \
  -p 5433:5432 \
  -v cardiac_pgdata:/var/lib/postgresql/data \
  postgres:17
```

> **Note:** Use port `5433` to avoid conflict if Windows PostgreSQL is installed natively on `5432`.

### 3. Set up Python virtual environment

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r backend/requirements.txt
```

### 4. Configure backend environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values
```

### 5. Start the FastAPI backend

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

Verify: `http://127.0.0.1:8000/health` → `{"status":"healthy"}`

Verify DB: `http://127.0.0.1:8000/health/database` → `{"status":"connected"}`

### 6. Configure frontend environment

```bash
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your Firebase web config values
```

### 7. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (psycopg3 format) |
| `GEMINI_API_KEY_1` | Gemini API key (primary) |
| `GEMINI_API_KEY_2` | Gemini API key (secondary / fallback) |
| `GEMINI_API_KEY_3` | Gemini API key (tertiary / fallback) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (use `/api` locally via Vite proxy) |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase analytics measurement ID |

---

## Production Deployment

| Component | Hosting |
|---|---|
| Frontend | [Vercel](https://vercel.com) — Root: `frontend/`, Build: `npm run build`, Output: `dist` |
| Backend | [Render](https://render.com) — Python 3.12, Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Database | [Neon](https://neon.tech) — Serverless managed PostgreSQL |
| Auth | Firebase Authentication |

> After deploying to Vercel, add your Vercel domain to Firebase → Authentication → Authorized Domains.

---

## Web Bluetooth Compatibility

| Platform | Browser | Live ECG Support |
|---|---|---|
| Windows | Chrome, Edge | ✅ Fully supported |
| macOS | Chrome, Edge | ✅ Fully supported |
| Android | Chrome, Edge | ✅ Fully supported |
| iOS / iPadOS | All browsers | ❌ Not supported (Apple restricts Web Bluetooth in WebKit) |
| Firefox (all) | Firefox | ❌ Not supported |

On unsupported platforms, the application displays an explanation and offers full access via **Demonstration Mode**.

---

## Hardware

The ESP32-S3 firmware is in [`esp32_sketch.ino`](./esp32_sketch.ino).

Streams BLE packets in format: `E:bio,adc,leadsOff,spo2,hr`

- AD8232 ECG analog front-end
- MAX30102 pulse oximeter (SpO₂ / IR)
- SSD1306 128×64 OLED display
- BLE GATT Notify characteristic

---

## Disclaimer

This is a **research and educational prototype** only. It is not a certified medical device. Do not use for clinical diagnosis or treatment decisions.

---

## License

For research and educational use. See individual file headers for applicable terms.
