import { BleConfiguration, BleConnectionStatus, BleDeviceInfo, BlePacket } from '../../types/ble';

// Default Heart Rate standard service / Custom ECG placeholder
export const DEFAULT_BLE_CONFIG: BleConfiguration = {
  serviceUuid: '0000180d-0000-1000-8000-00805f9b34fb', // Standard Heart Rate Service
  characteristicUuid: '00002a37-0000-1000-8000-00805f9b34fb', // Standard Measurement Characteristic
  sampleRateHz: 360, // Matching MIT-BIH research pipeline default
};

export class BleAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private status: BleConnectionStatus = 'disconnected';
  private config: BleConfiguration = { ...DEFAULT_BLE_CONFIG };

  private onStatusChangeCallbacks: Array<(status: BleConnectionStatus) => void> = [];
  private onDataCallbacks: Array<(packet: BlePacket) => void> = [];
  private onErrorCallbacks: Array<(error: string) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && !navigator.bluetooth) {
      this.status = 'unsupported';
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!navigator.bluetooth;
  }

  public getStatus(): BleConnectionStatus {
    return this.status;
  }

  public getConfig(): BleConfiguration {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<BleConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public onStatusChange(callback: (status: BleConnectionStatus) => void): () => void {
    this.onStatusChangeCallbacks.push(callback);
    callback(this.status);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onData(callback: (packet: BlePacket) => void): () => void {
    this.onDataCallbacks.push(callback);
    return () => {
      this.onDataCallbacks = this.onDataCallbacks.filter((cb) => cb !== callback);
    };
  }

  public onError(callback: (error: string) => void): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter((cb) => cb !== callback);
    };
  }

  private setStatus(status: BleConnectionStatus) {
    this.status = status;
    this.onStatusChangeCallbacks.forEach((cb) => cb(status));
  }

  private emitError(message: string) {
    this.onErrorCallbacks.forEach((cb) => cb(message));
  }

  public async connect(): Promise<BleDeviceInfo> {
    const bluetooth = typeof navigator !== 'undefined' ? navigator.bluetooth : undefined;
    if (!bluetooth) {
      this.setStatus('unsupported');
      throw new Error('Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge on a supported platform.');
    }

    try {
      this.setStatus('connecting');

      // Request device with service filters or acceptAllDevices with optionalServices
      this.device = await bluetooth.requestDevice({
        filters: [{ services: [this.config.serviceUuid] }],
        optionalServices: [this.config.serviceUuid],
      }).catch(async (err: Error) => {
        // Fallback: If filtered scan yields no match or user wants to pick any ESP32 device
        if (err.name === 'NotFoundError') {
          throw err;
        }
        return await bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [this.config.serviceUuid],
        });
      });

      if (!this.device) {
        throw new Error('No Bluetooth device selected.');
      }

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      if (!this.device.gatt) {
        throw new Error('Selected Bluetooth device does not provide a GATT server.');
      }

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(this.config.serviceUuid);
      this.characteristic = await service.getCharacteristic(this.config.characteristicUuid);

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));

      this.setStatus('connected');

      return {
        id: this.device.id,
        name: this.device.name || 'Unnamed BLE Peripheral',
        connected: true,
      };
    } catch (err: unknown) {
      this.setStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      this.emitError(msg);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.characteristic) {
        try {
          await this.characteristic.stopNotifications();
        } catch {
          // Ignore error if already disconnected
        }
        this.characteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged);
        this.characteristic = null;
      }

      if (this.device && this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }

      this.device = null;
      this.server = null;
      this.setStatus('disconnected');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitError(`Disconnect error: ${msg}`);
      this.setStatus('disconnected');
    }
  }

  private handleDisconnection() {
    this.setStatus('disconnected');
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  private handleCharacteristicValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    // Standard Heart Rate Measurement format or Raw 16-bit ECG sample
    const packet: BlePacket = {
      timestamp: performance.now(),
      voltageMv: 0,
    };

    if (value.byteLength >= 2) {
      const flags = value.getUint8(0);
      const is16Bit = (flags & 0x01) !== 0;
      let bpm = 0;
      if (is16Bit && value.byteLength >= 3) {
        bpm = value.getUint16(1, /*littleEndian=*/true);
      } else {
        bpm = value.getUint8(1);
      }

      // Convert BPM or raw sensor ADC voltage to mV
      packet.rawSample = bpm;
      packet.voltageMv = (bpm / 100) - 0.5; // Normalized indicative voltage
    }

    this.onDataCallbacks.forEach((cb) => cb(packet));
  }
}

export const bleAdapter = new BleAdapter();
