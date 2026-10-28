import React, { useEffect, useState } from 'react';
import { AlertCircle, Bluetooth, ChevronDown, ChevronUp, Cpu, RefreshCw, Settings, ShieldCheck, Sliders, XCircle } from 'lucide-react';
import { bleAdapter, DEFAULT_BLE_CONFIG } from '../../services/ble/adapter';
import { BleConfiguration, BleConnectionStatus, BleDeviceInfo } from '../../types/ble';

export const DeviceConnector: React.FC = () => {
  const [status, setStatus] = useState<BleConnectionStatus>(bleAdapter.getStatus());
  const [deviceInfo, setDeviceInfo] = useState<BleDeviceInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Configuration modal/settings
  const [config, setConfig] = useState<BleConfiguration>(bleAdapter.getConfig());
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    setIsSupported(bleAdapter.isSupported());

    const unsubStatus = bleAdapter.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const unsubError = bleAdapter.onError((err) => {
      setErrorMsg(err);
    });

    return () => {
      unsubStatus();
      unsubError();
    };
  }, []);

  const handleConnect = async () => {
    setErrorMsg(null);
    try {
      const dev = await bleAdapter.connect();
      setDeviceInfo(dev);
    } catch {
      // Handled via onError callback
    }
  };

  const handleDisconnect = async () => {
    try {
      await bleAdapter.disconnect();
      setDeviceInfo(null);
    } catch {
      // Handled via adapter
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    bleAdapter.updateConfig(config);
    setShowAdvanced(false);
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compatible ECG Sensor & Telemetry</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Wireless acquisition interface using the Web Bluetooth API to stream biopotential signals from compatible wearable cardiac sensors.
        </p>
      </div>

      {/* Browser Support Check */}
      {!isSupported && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
              Web Bluetooth Not Supported:
            </span>
            <p className="leading-relaxed">
              Your current web browser does not support the <strong>Web Bluetooth API</strong>. Please run this dashboard in 
              <strong> Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Chromium</strong> on Windows, macOS, Android, or ChromeOS.
            </p>
          </div>
        </div>
      )}

      {/* Connection Control Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                status === 'connected'
                  ? 'bg-emerald-100 text-emerald-700'
                  : status === 'connecting'
                  ? 'bg-sky-100 text-sky-700 animate-pulse'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Bluetooth className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  {status === 'connected' && deviceInfo
                    ? deviceInfo.name
                    : 'Wireless ECG Sensor'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    status === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : status === 'connecting'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : status === 'error'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {status === 'connected' && deviceInfo ? `Device ID: ${deviceInfo.id}` : 'Ready to pair BLE Peripheral'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Advanced Hardware & GATT Configuration"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Advanced Config</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {status === 'connected' ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-lg transition-all"
              >
                Disconnect Sensor
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!isSupported || status === 'connecting'}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                {status === 'connecting' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning for Devices...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Pair Compatible ECG Device</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pairing Notification:</span>
              <p className="mt-0.5 text-rose-700/90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Sensor Compatibility Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
            <span className="font-bold text-slate-900 block">1. Supported Hardware Profiles</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Pairs with Bluetooth 5.0+ LE single-lead biopotential transmitters, custom research boards, and reference microcontrollers.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
            <span className="font-bold text-slate-900 block">2. Real-Time Telemetry Stream</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Ingests digitized millivolt voltages at calibrated 360 Hz sampling rates directly to the 60 FPS Sweep Monitor.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
            <span className="font-bold text-slate-900 block">3. Digital Twin Synchronization</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Provides real live cardiac cycle windows to the 234-feature extraction pipeline and Random Forest classifier.
            </p>
          </div>
        </div>

        {/* Collapsible Advanced Hardware Configuration & Technical Pinouts */}
        {showAdvanced && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-slate-800 text-sm">Advanced Hardware & GATT Specification</h4>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...DEFAULT_BLE_CONFIG })}
                className="text-[11px] text-sky-600 hover:underline"
              >
                Restore Standard Defaults
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GATT Primary Service UUID
                  </label>
                  <input
                    type="text"
                    value={config.serviceUuid}
                    onChange={(e) => setConfig({ ...config, serviceUuid: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Advertised primary BLE service UUID</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GATT Characteristic UUID (Notify)
                  </label>
                  <input
                    type="text"
                    value={config.characteristicUuid}
                    onChange={(e) => setConfig({ ...config, characteristicUuid: e.target.value.trim() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Subscribed notification characteristic</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Sampling Frequency (Hz)
                </label>
                <input
                  type="number"
                  value={config.sampleRateHz}
                  onChange={(e) => setConfig({ ...config, sampleRateHz: Number(e.target.value) })}
                  className="w-48 px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px] focus:ring-1 focus:ring-sky-500 bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default 360 Hz aligns with MIT-BIH Arrhythmia benchmark</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-2xs"
                >
                  Apply Configuration
                </button>
              </div>
            </form>

            {/* Technical Pinout & Microcontroller Reference Details */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-600" />
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Technical Reference: ESP32 + AD8232 Pinout & Firmware
                </h5>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-600 space-y-1 leading-relaxed">
                <p><strong>Analog Front-End:</strong> AD8232 Single-Lead Heart Rate Monitor</p>
                <p><strong>Wiring Pinout:</strong> AD8232 OUT → ESP32 GPIO 36 (VP ADC1_CH0) • 3.3V → 3V3 • GND → GND</p>
                <p><strong>Leads-Off Detection:</strong> LO+ → GPIO 22 • LO- → GPIO 23</p>
                <p><strong>Firmware Sampling:</strong> Hardware Timer Interrupt @ 360 Hz • 12-bit ADC (0–4095)</p>
                <p><strong>BLE Packet Structure:</strong> 2-byte signed integer millivolts payload (V_mV = (ADC * 3300) / (4095 * Gain))</p>
              </div>
            </div>
          </div>
        )}

        {/* Verification Status */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>Hardware Status: Web Bluetooth adapter active. Safe biopotential isolation recommended.</span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-400">Bluetooth 5.0+ LE</span>
        </div>
      </div>
    </div>
  );
};
