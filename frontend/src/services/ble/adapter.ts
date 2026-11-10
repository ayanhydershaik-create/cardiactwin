import { BleConfiguration, BleConnectionStatus, BleDeviceInfo, BlePacket } from '../../types/ble';

// ESP32-S3 CARDIAC_TWIN hardware UUIDs
export const DEFAULT_BLE_CONFIG: BleConfiguration = {
  serviceUuid: '7b8a0001-6d5b-4f6a-9c2e-123456789001',
  characteristicUuid: '7b8a0002-6d5b-4f6a-9c2e-123456789001',
  sampleRateHz: 250, // 4000us = 250 Hz from ESP32 ECG_INTERVAL_US
};

export class BleAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private status: BleConnectionStatus = 'disconnected';
  private config: BleConfiguration = { ...DEFAULT_BLE_CONFIG };

  // High-pass DC Blocker (AHA / IEC standard for ECG baseline stabilization)
  // Prevents baseline drift/mountains and locks isoelectric baseline to 0.0 mV
  private xPrev = 2048.0;
  private yPrev = 0.0;

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
      throw new Error(
        'Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge on a supported platform.'
      );
    }

    try {
      this.setStatus('connecting');

      this.device = await bluetooth.requestDevice({
        filters: [
          { name: 'CARDIAC_TWIN' },
          { namePrefix: 'CARDIAC' },
          { services: [this.config.serviceUuid] },
        ],
        optionalServices: [
          this.config.serviceUuid,
          '0000180d-0000-1000-8000-00805f9b34fb',
        ],
      }).catch(async (err: Error) => {
        if (err.name === 'NotFoundError') {
          throw err;
        }
        return await bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            this.config.serviceUuid,
            '0000180d-0000-1000-8000-00805f9b34fb',
          ],
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

      let service: BluetoothRemoteGATTService;
      try {
        service = await this.server.getPrimaryService(this.config.serviceUuid);
      } catch {
        service = await this.server.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
      }

      try {
        this.characteristic = await service.getCharacteristic(this.config.characteristicUuid);
      } catch {
        this.characteristic = await service.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
      }

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicValueChanged.bind(this)
      );

      this.setStatus('connected');

      return {
        id: this.device.id,
        name: this.device.name || 'CARDIAC_TWIN',
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
          // Ignore
        }
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleCharacteristicValueChanged
        );
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

  private convertAdcToMv(raw: number): number {
    if (!Number.isFinite(raw)) {
      return 0.0;
    }

    // ── 1. If raw is already centered biopotential from ESP32 (-800 to +800):
    // Standard calibration: 1.0 mV is ~45 ADC biopotential units on AD8232 with 1100x gain.
    if (Math.abs(raw) <= 800) {
      const mv = raw / 45.0;
      return Math.max(-2.5, Math.min(2.5, mv));
    }

    // ── 2. If raw is full uncentered ADC count (800 - 4095):
    // Clinical High-Pass DC Blocker filter: y[n] = (x[n] - x[n-1]) + 0.95 * y[n-1]
    const diff = raw - this.xPrev;
    this.xPrev = raw;
    const y = diff + 0.95 * this.yPrev;
    this.yPrev = y;

    const mv = y / 60.0;
    return Math.max(-2.5, Math.min(2.5, mv));
  }

  private handleCharacteristicValueChanged(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const packet: BlePacket = {
      timestamp: performance.now(),
      voltageMv: 0,
    };

    try {
      const text = new TextDecoder('utf-8').decode(value).trim();

      if (text.includes('CARDIAC_TWIN_READY') || text.length === 0) {
        return;
      }

      // ── 1. Format: "E:..." (Compact & Batched)
      if (text.startsWith('E:')) {
        const payloadStr = text.slice(2);

        // Batched samples with separator: "E:s1,s2,s3|leadsOff,spo2,hr" or "E:s1,s2,s3|adc,leadsOff,spo2,hr"
        if (payloadStr.includes('|')) {
          const [ecgPart, vitalsPart] = payloadStr.split('|');
          const rawSamples = ecgPart.split(',').map((v) => parseInt(v, 10)).filter(Number.isFinite);
          const vParts = vitalsPart.split(',');

          let leadsOff = false;
          let spo2 = 0;
          let heartRate = 0;
          let ecgRawAdc = rawSamples[rawSamples.length - 1] || 0;

          if (vParts.length >= 4) {
            ecgRawAdc = parseInt(vParts[0], 10) || ecgRawAdc;
            leadsOff = parseInt(vParts[1], 10) === 1;
            spo2 = parseInt(vParts[2], 10) || 0;
            heartRate = parseFloat(vParts[3]) || 0;
          } else if (vParts.length >= 3) {
            leadsOff = parseInt(vParts[0], 10) === 1;
            spo2 = parseInt(vParts[1], 10) || 0;
            heartRate = parseFloat(vParts[2]) || 0;
          }

          const mvSamples = leadsOff ? rawSamples.map(() => 0.0) : rawSamples.map((r) => this.convertAdcToMv(r));
          packet.samples = mvSamples;
          packet.voltageMv = leadsOff ? 0.0 : (mvSamples[mvSamples.length - 1] || 0.0);
          packet.ecgRaw = ecgRawAdc;
          packet.leadsOff = leadsOff;
          packet.loPlus = leadsOff ? 1 : 0;
          packet.loMinus = leadsOff ? 1 : 0;
          packet.spo2 = spo2 > 0 ? spo2 : undefined;
          packet.irValue = spo2;
          packet.heartRate = heartRate;
          packet.rawSample = heartRate > 0 ? Math.round(heartRate) : undefined;

          this.onDataCallbacks.forEach((cb) => cb(packet));
          return;
        } else {
          // Comma-separated: "E:bio,adc,leadsOff,spo2,hr" (5 parts) or "E:ecgRaw,leadsOff,spo2,hr" (4 parts)
          const parts = payloadStr.split(',');
          if (parts.length >= 5) {
            const bio = parseInt(parts[0], 10);
            const adc = parseInt(parts[1], 10);
            const leadsOff = parts[2] === '1';
            const spo2 = parseInt(parts[3], 10) || 0;
            const heartRate = parseFloat(parts[4]) || 0;

            packet.voltageMv = leadsOff ? 0.0 : this.convertAdcToMv(bio);
            packet.ecgRaw = Number.isFinite(adc) ? adc : bio;
            packet.leadsOff = leadsOff;
            packet.loPlus = leadsOff ? 1 : 0;
            packet.loMinus = leadsOff ? 1 : 0;
            packet.spo2 = spo2 > 0 ? spo2 : undefined;
            packet.irValue = spo2;
            packet.heartRate = heartRate;
            packet.rawSample = heartRate > 0 ? Math.round(heartRate) : undefined;

            this.onDataCallbacks.forEach((cb) => cb(packet));
            return;
          } else if (parts.length >= 4) {
            const ecgRaw = parseInt(parts[0], 10);
            const leadsOff = parts[1] === '1';
            const spo2 = parseInt(parts[2], 10) || 0;
            const heartRate = parseFloat(parts[3]) || 0;

            packet.voltageMv = leadsOff ? 0.0 : this.convertAdcToMv(ecgRaw);
            packet.ecgRaw = ecgRaw;
            packet.leadsOff = leadsOff;
            packet.loPlus = leadsOff ? 1 : 0;
            packet.loMinus = leadsOff ? 1 : 0;
            packet.spo2 = spo2 > 0 ? spo2 : undefined;
            packet.irValue = spo2;
            packet.heartRate = heartRate;
            packet.rawSample = heartRate > 0 ? Math.round(heartRate) : undefined;

            this.onDataCallbacks.forEach((cb) => cb(packet));
            return;
          } else if (parts.length >= 1) {
            const ecgRaw = parseInt(parts[0], 10);
            packet.voltageMv = this.convertAdcToMv(ecgRaw);
            packet.ecgRaw = ecgRaw;
            this.onDataCallbacks.forEach((cb) => cb(packet));
            return;
          }
        }
      }

      // ── 2. Batched ECG format: "B:v1;v2;v3;v4;v5|loP,loM,ir,red,hr,ax,ay,az"
      if (text.startsWith('B:')) {
        const [ecgPart, vitalsPart] = text.slice(2).split('|');
        const rawSamples = ecgPart.split(';').map((v) => parseInt(v, 10)).filter(Number.isFinite);
        
        let loPlus = 0;
        let loMinus = 0;
        let irValue = 0;
        let redValue = 0;
        let heartRate = 0;

        if (vitalsPart) {
          const vParts = vitalsPart.split(',');
          loPlus = parseInt(vParts[0], 10) || 0;
          loMinus = parseInt(vParts[1], 10) || 0;
          irValue = parseInt(vParts[2], 10) || 0;
          redValue = parseInt(vParts[3], 10) || 0;
          heartRate = parseFloat(vParts[4]) || 0;
        }

        const leadsOff = loPlus === 1 || loMinus === 1;
        const mvSamples = rawSamples.map((r) => this.convertAdcToMv(r));

        packet.samples = mvSamples;
        packet.voltageMv = mvSamples[mvSamples.length - 1] || 0;
        packet.ecgRaw = rawSamples[rawSamples.length - 1];
        packet.loPlus = loPlus;
        packet.loMinus = loMinus;
        packet.leadsOff = leadsOff;
        packet.irValue = irValue;
        packet.redValue = redValue;
        packet.heartRate = heartRate;
        packet.rawSample = heartRate > 0 ? Math.round(heartRate) : undefined;

        this.onDataCallbacks.forEach((cb) => cb(packet));
        return;
      }

      // ── 3. Universal CSV format (parses 2, 4, 6, or 12 parameters)
      if (text.includes(',')) {
        const parts = text.split(',');
        if (parts.length >= 2) {
          const ecgRaw = parseInt(parts[0], 10);
          const loPlus = parseInt(parts[1], 10) || 0;
          const loMinus = parts.length > 2 ? parseInt(parts[2], 10) || 0 : 0;
          const spo2OrIr = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
          const redValue = parts.length > 4 ? parseInt(parts[4], 10) || 0 : 0;
          const heartRate = parts.length > 5 ? parseFloat(parts[5]) || 0 : (parts.length === 4 ? parseFloat(parts[3]) || 0 : 0);

          const leadsOff = loPlus === 1 || loMinus === 1;
          const mv = this.convertAdcToMv(ecgRaw);

          packet.voltageMv = mv;
          packet.ecgRaw = ecgRaw;
          packet.loPlus = loPlus;
          packet.loMinus = loMinus;
          packet.leadsOff = leadsOff;
          packet.irValue = spo2OrIr;
          packet.spo2 = spo2OrIr > 0 && spo2OrIr <= 100 ? spo2OrIr : undefined;
          packet.redValue = redValue;
          packet.heartRate = heartRate;
          packet.rawSample = heartRate > 0 && Number.isFinite(heartRate) ? Math.round(heartRate) : undefined;

          this.onDataCallbacks.forEach((cb) => cb(packet));
          return;
        }
      }

      // ── 4. Single raw integer fallback
      const singleVal = parseInt(text, 10);
      if (Number.isFinite(singleVal)) {
        packet.voltageMv = this.convertAdcToMv(singleVal);
        packet.ecgRaw = singleVal;
        this.onDataCallbacks.forEach((cb) => cb(packet));
        return;
      }
    } catch {
      // Fall through to binary
    }

    // Binary fallback (0x180D)
    if (value.byteLength >= 2) {
      const flags = value.getUint8(0);
      const is16Bit = (flags & 0x01) !== 0;
      let bpm = 0;
      if (is16Bit && value.byteLength >= 3) {
        bpm = value.getUint16(1, true);
      } else {
        bpm = value.getUint8(1);
      }

      packet.rawSample = bpm;
      packet.heartRate = bpm;
      packet.voltageMv = (bpm / 100) - 0.5;
    }

    this.onDataCallbacks.forEach((cb) => cb(packet));
  }
}

export const bleAdapter = new BleAdapter();
