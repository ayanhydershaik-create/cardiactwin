
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = __import__("sqlalchemy").Column(Integer, primary_key=True, index=True)
    external_id = __import__("sqlalchemy").Column(String(100), unique=True, nullable=True)
    display_name = __import__("sqlalchemy").Column(String(150), nullable=False)
    date_of_birth = __import__("sqlalchemy").Column(DateTime, nullable=True)
    created_at = __import__("sqlalchemy").Column(DateTime(timezone=True), server_default=func.now())


class ECGObservation(Base):
    __tablename__ = "ecg_observations"

    id = __import__("sqlalchemy").Column(Integer, primary_key=True, index=True)
    patient_id = __import__("sqlalchemy").Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    source = __import__("sqlalchemy").Column(String(100), nullable=False, default="MIT-BIH")
    record_name = __import__("sqlalchemy").Column(String(100), nullable=True)
    sampled_at = __import__("sqlalchemy").Column(DateTime(timezone=True), nullable=True)
    sample_rate_hz = __import__("sqlalchemy").Column(Float, nullable=True)
    signal_data = __import__("sqlalchemy").Column(JSON, nullable=True)
    created_at = __import__("sqlalchemy").Column(DateTime(timezone=True), server_default=func.now())


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = __import__("sqlalchemy").Column(Integer, primary_key=True, index=True)
    patient_id = __import__("sqlalchemy").Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    observation_id = __import__("sqlalchemy").Column(Integer, ForeignKey("ecg_observations.id"), nullable=True)
    model_name = __import__("sqlalchemy").Column(String(100), nullable=False)
    predicted_class = __import__("sqlalchemy").Column(String(100), nullable=False)
    confidence = __import__("sqlalchemy").Column(Float, nullable=True)
    is_research_output = __import__("sqlalchemy").Column(Boolean, nullable=False, default=True)
    created_at = __import__("sqlalchemy").Column(DateTime(timezone=True), server_default=func.now())


class DigitalTwinState(Base):
    __tablename__ = "digital_twin_states"

    id = __import__("sqlalchemy").Column(Integer, primary_key=True, index=True)
    patient_id = __import__("sqlalchemy").Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    state_name = __import__("sqlalchemy").Column(String(100), nullable=False)
    state_data = __import__("sqlalchemy").Column(JSON, nullable=False, default=dict)
    recorded_at = __import__("sqlalchemy").Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AgentActivity(Base):
    __tablename__ = "agent_activities"

    id = __import__("sqlalchemy").Column(Integer, primary_key=True, index=True)
    agent_name = __import__("sqlalchemy").Column(String(100), nullable=False)
    action = __import__("sqlalchemy").Column(String(150), nullable=False)
    status = __import__("sqlalchemy").Column(String(50), nullable=False, default="completed")
    details = __import__("sqlalchemy").Column(Text, nullable=True)
    created_at = __import__("sqlalchemy").Column(DateTime(timezone=True), server_default=func.now())
