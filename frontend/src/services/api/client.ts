import {
  BackendHealthResponse,
  BackendRootResponse,
  DatabaseHealthResponse,
  ECGObservationCreate,
  ECGObservationRead,
  HeartbeatPredictionResponse,
  PatientCreate,
  PatientRead,
} from '../../types/api';

const DEFAULT_BASE_URL = '/api';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson.detail) {
            errorDetail = typeof errorJson.detail === 'string' 
              ? errorJson.detail 
              : JSON.stringify(errorJson.detail);
          }
        } catch {
          // If not JSON, use status text
        }
        throw new Error(errorDetail);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`API request timed out after 10s connecting to ${url}`);
        }
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          throw new Error(`Cannot reach backend at ${this.baseUrl}. Please verify the FastAPI server is running on port 8000.`);
        }
        throw err;
      }
      throw new Error(String(err));
    }
  }

  /** GET /: Root health & status */
  public async getRoot(): Promise<BackendRootResponse> {
    return this.request<BackendRootResponse>('/');
  }

  /** GET /health: API service health */
  public async getHealth(): Promise<BackendHealthResponse> {
    return this.request<BackendHealthResponse>('/health');
  }

  /** GET /health/database: PostgreSQL database connection health */
  public async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    return this.request<DatabaseHealthResponse>('/health/database');
  }

  /** GET /patients: List registered research patients */
  public async listPatients(skip = 0, limit = 100): Promise<PatientRead[]> {
    return this.request<PatientRead[]>(`/patients?skip=${skip}&limit=${limit}`);
  }

  /** POST /patients: Register a new patient */
  public async createPatient(patient: PatientCreate): Promise<PatientRead> {
    return this.request<PatientRead>('/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    });
  }

  /** GET /ecg-observations: List recorded ECG observations */
  public async listECGObservations(patientId?: number, skip = 0, limit = 100): Promise<ECGObservationRead[]> {
    const query = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    if (patientId !== undefined) {
      query.set('patient_id', String(patientId));
    }
    return this.request<ECGObservationRead[]>(`/ecg-observations?${query.toString()}`);
  }

  /** POST /ecg-observations: Record a new observation */
  public async createECGObservation(obs: ECGObservationCreate): Promise<ECGObservationRead> {
    return this.request<ECGObservationRead>('/ecg-observations', {
      method: 'POST',
      body: JSON.stringify(obs),
    });
  }

  /**
   * POST /predict/heartbeat: Run machine-learning classification on exactly 234 preprocessed ECG samples.
   */
  public async predictHeartbeat(features: number[]): Promise<HeartbeatPredictionResponse> {
    if (!Array.isArray(features)) {
      throw new Error('Input features must be an array of numerical values.');
    }
    if (features.length !== 234) {
      throw new Error(`Exactly 234 heartbeat features are required by the ML model. Provided ${features.length}.`);
    }

    const invalidIndex = features.findIndex((v) => typeof v !== 'number' || !Number.isFinite(v));
    if (invalidIndex !== -1) {
      throw new Error(`Feature at index ${invalidIndex} is invalid (${features[invalidIndex]}). All values must be finite numbers.`);
    }

    return this.request<HeartbeatPredictionResponse>('/predict/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ features }),
    });
  }
}

export const apiClient = new ApiClient();
