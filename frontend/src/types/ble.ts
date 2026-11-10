export type BleConnectionStatus =
  | 'unsupported'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface BleDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface BleConfiguration {
  serviceUuid: string;
  characteristicUuid: string;
  sampleRateHz: number;
}

export interface BlePacket {
  timestamp: number;
  voltageMv: number;
  rawSample?: number;
  samples?: number[]; // Array of voltages in mV if sent in batches
  // ESP32 CARDIAC_TWIN hardware telemetry
  ecgRaw?: number;
  loPlus?: number;
  loMinus?: number;
  leadsOff?: boolean;
  irValue?: number;
  redValue?: number;
  spo2?: number; // Blood Oxygen Saturation (SpO2) in percentage (e.g. 98)
  heartRate?: number;
  ax?: number;
  ay?: number;
  az?: number;
  gx?: number;
  gy?: number;
  gz?: number;
}
