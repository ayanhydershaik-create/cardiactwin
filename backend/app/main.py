from pydantic import BaseModel, Field
from app.ecg_predictor import predict_heartbeat
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.models import Patient, ECGObservation
from app.schemas import (
    PatientCreate,
    PatientRead,
    ECGObservationCreate,
    ECGObservationRead,
)
from app.agent_router import router as agent_router

app = FastAPI(
    title="Cardiac Digital Twin API",
    description="Research prototype for ECG analysis, cardiac digital twin monitoring — powered by Gemini Agentic AI.",
    version="0.3.0",
)

# CORS configuration supporting localhost and production Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unified Router serving both root paths (for local dev) and /api paths (for Vercel rewrites)
api_router = APIRouter()

# Mount agentic AI router at /agent/...
api_router.include_router(agent_router)


class HeartbeatPredictionRequest(BaseModel):
    features: list[float] = Field(
        ...,
        min_length=234,
        max_length=234,
        description="Exactly 234 preprocessed ECG heartbeat features",
    )

@api_router.get("/")
def root():
    return {
        "message": "Cardiac Digital Twin API is running",
        "status": "ok",
        "version": "0.3.0",
        "agentic_ai": "enabled",
    }


@api_router.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "cardiac-digital-twin-api",
    }


@api_router.get("/health/database")
def database_health():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT current_database(), current_user")
            ).fetchone()

        return {
            "status": "connected",
            "database": result[0],
            "user": result[1],
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )


@api_router.post("/patients", response_model=PatientRead, status_code=201)
def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
):
    patient = Patient(**patient_data.model_dump())
    db.add(patient)

    try:
        db.commit()
        db.refresh(patient)
        return patient
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A patient with this external_id already exists",
        )


@api_router.get("/patients", response_model=list[PatientRead])
def list_patients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if skip < 0 or not 1 <= limit <= 100:
        raise HTTPException(
            status_code=400,
            detail="skip must be non-negative and limit must be between 1 and 100",
        )

    return (
        db.query(Patient)
        .order_by(Patient.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@api_router.post(
    "/ecg-observations",
    response_model=ECGObservationRead,
    status_code=201,
)
def create_ecg_observation(
    observation_data: ECGObservationCreate,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, observation_data.patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    observation = ECGObservation(**observation_data.model_dump())
    db.add(observation)
    db.commit()
    db.refresh(observation)

    return observation


@api_router.get(
    "/ecg-observations",
    response_model=list[ECGObservationRead],
)
def list_ecg_observations(
    patient_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if skip < 0 or not 1 <= limit <= 100:
        raise HTTPException(
            status_code=400,
            detail="skip must be non-negative and limit must be between 1 and 100",
        )

    query = db.query(ECGObservation)

    if patient_id is not None:
        query = query.filter(ECGObservation.patient_id == patient_id)

    return (
        query.order_by(ECGObservation.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@api_router.post("/predict/heartbeat")
def predict_ecg_heartbeat(request: HeartbeatPredictionRequest):
    try:
        return predict_heartbeat(request.features)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")

# Mount unified router for both root and /api prefixes
app.include_router(api_router)
app.include_router(api_router, prefix="/api")
