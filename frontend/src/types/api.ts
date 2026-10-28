/**
 * API Contracts matching FastAPI Backend (backend/app/schemas.py & backend/app/main.py)
 */

export interface BackendRootResponse {
  message: string;
  status: string;
}

export interface BackendHealthResponse {
  status: 'healthy' | 'unhealthy' | string;
  service: string;
}

export interface DatabaseHealthResponse {
  status: 'connected' | 'disconnected' | string;
  database: string;
  user: string;
}

export interface PatientCreate {
  external_id?: string | null;
  display_name: string;
  date_of_birth?: string | null;
}

export interface PatientRead {
  id: number;
  external_id: string | null;
  display_name: string;
  date_of_birth: string | null;
  created_at: string | null;
}

export interface ECGObservationCreate {
  patient_id: number;
  source?: string;
  record_name?: string | null;
  sample_rate_hz?: number | null;
  sampled_at?: string | null;
}

export interface ECGObservationRead {
  id: number;
  patient_id: number;
  source: string;
  record_name: string | null;
  sampled_at: string | null;
  sample_rate_hz: number | null;
  created_at: string | null;
}

export interface HeartbeatPredictionRequest {
  /** Exactly 234 preprocessed ECG heartbeat features */
  features: number[];
}

export interface HeartbeatPredictionResponse {
  predicted_class: 'N' | 'S' | 'V' | 'Q' | string;
  class_probabilities: {
    N?: number;
    S?: number;
    V?: number;
    Q?: number;
    [key: string]: number | undefined;
  };
  model_type: string;
  clinical_use: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}
