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
}
