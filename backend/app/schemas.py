
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PatientCreate(BaseModel):
    external_id: str | None = Field(default=None, max_length=100)
    display_name: str = Field(min_length=1, max_length=150)
    date_of_birth: datetime | None = None


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str | None
    display_name: str
    date_of_birth: datetime | None
    created_at: datetime | None


class ECGObservationCreate(BaseModel):
    patient_id: int
    source: str = Field(default="MIT-BIH", max_length=100)
    record_name: str | None = Field(default=None, max_length=100)
    sample_rate_hz: float | None = Field(default=None, gt=0)
    sampled_at: datetime | None = None


class ECGObservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    source: str
    record_name: str | None
    sampled_at: datetime | None
    sample_rate_hz: float | None
    created_at: datetime | None
