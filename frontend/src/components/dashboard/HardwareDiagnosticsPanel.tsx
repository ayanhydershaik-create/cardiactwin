import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  Navigation, 
  MapPin, 
  ExternalLink, 
  AlertTriangle, 
  Radio, 
  Play, 
  Square,
  Sparkles,
  Info
} from 'lucide-react';
import { bleAdapter } from '../../services/ble/adapter';
import { BleConnectionStatus, GpsTelemetry } from '../../types/ble';

export const HardwareDiagnosticsPanel: React.FC = () => {
  const [bleStatus, setBleStatus] = useState<BleConnectionStatus>(bleAdapter.getStatus());
  const [buzzerTesting, setBuzzerTesting] = useState(false);
  const [sosTesting, setSosTesting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<GpsTelemetry | null>(bleAdapter.getLatestGps());

  useEffect(() => {
    const unsubStatus = bleAdapter.onStatusChange((s) => setBleStatus(s));
    const unsubGps = bleAdapter.onGps((gps) => setGpsData(gps));
    return () => {
      unsubStatus();
      unsubGps();
    };
  }, []);

  const handleTestBuzzer = async () => {
    if (bleStatus !== 'connected') {
      setActionFeedback('⚠️ Connect Bluetooth first to test the buzzer.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    setBuzzerTesting(true);
    setActionFeedback('🔊 Command sent! Pulsing buzzer on GPIO 7 for 3 seconds...');
    await bleAdapter.sendCommand('TEST_BUZZER');

    setTimeout(() => {
      setBuzzerTesting(false);
      setActionFeedback('✅ Buzzer test complete. Did you hear the double-beep?');
      setTimeout(() => setActionFeedback(null), 4000);
    }, 3000);
  };

  const handleTestSos = async () => {
    if (bleStatus !== 'connected') {
      setActionFeedback('⚠️ Connect Bluetooth first to test the SOS sequence.');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    setSosTesting(true);
    setActionFeedback('🚨 30-Second SOS Emergency Countdown armed on ESP32 & OLED!');
    await bleAdapter.sendCommand('TEST_SOS');
  };

  const handleStopBuzzer = async () => {
    if (bleStatus !== 'connected') return;
    setBuzzerTesting(false);
    setSosTesting(false);
    await bleAdapter.sendCommand('RESET_SOS');
    setActionFeedback('🛑 Buzzer silenced & alert state reset to normal.');
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const isConnected = bleStatus === 'connected';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Hardware Verification Suite</h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Active Buzzer & Neo-6M GPS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time diagnostics and interactive verification tools to confirm physical sensor wiring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-xs font-semibold text-slate-700">
            {isConnected ? 'ESP32 Connected' : 'Sensor Offline'}
          </span>
          {!isConnected && (
            <button
              onClick={() => bleAdapter.connect()}
              className="ml-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
            >
              Pair via Bluetooth
            </button>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Grid: Buzzer on Left, GPS on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* ── 1. ACTIVE BUZZER VERIFICATION ── */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-rose-600" />
                Active Alarm Buzzer (GPIO 7)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                buzzerTesting || sosTesting
                  ? 'bg-rose-100 text-rose-800 animate-pulse'
                  : isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {buzzerTesting || sosTesting ? 'PULSING ACTIVE' : isConnected ? 'STANDBY READY' : 'OFFLINE'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Sends an immediate digital pulse trigger to <strong>GPIO 7</strong> on your ESP32 to verify acoustic loudness and cadence.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleTestBuzzer}
                disabled={!isConnected || buzzerTesting}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Test Buzzer (3s)</span>
              </button>

              <button
                onClick={handleTestSos}
                disabled={!isConnected}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Test 30s SOS</span>
              </button>
            </div>

            {(buzzerTesting || sosTesting) && (
              <button
                onClick={handleStopBuzzer}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Silence Buzzer & Reset Alert</span>
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 block flex items-center gap-1">
              <Info className="w-3 h-3 text-sky-600" />
              Wiring Check:
            </span>
            <p>• Red Wire → <strong>GPIO 7</strong> (or 5V with Transistor switch)</p>
            <p>• Black Wire → <strong>GND</strong></p>
            <p className="text-[10px] text-amber-700 pt-0.5">
              * If the ESP32 restarts or buzzer is faint, use an NPN transistor (2N2222) to draw current from 5V.
            </p>
          </div>
        </div>

        {/* ── 2. NEO-6M GPS SATELLITE TELEMETRY ── */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-emerald-600" />
                Neo-6M GPS Module (UART1)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                gpsData?.hasFix
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {gpsData?.hasFix ? 'SATELLITES LOCKED' : 'SEARCHING SATELLITES'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Decodes continuous NMEA sentences ($GPRMC & $GPGGA) received via Hardware UART1 (RX 18, TX 17).
            </p>
          </div>

          {/* Coordinate Readout */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Latitude:</span>
              <strong className="text-slate-900">
                {gpsData?.hasFix ? gpsData.lat.toFixed(6) : (isConnected ? 'Acquiring lock...' : 'Waiting for BLE...')}
              </strong>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>Longitude:</span>
              <strong className="text-slate-900">
                {gpsData?.hasFix ? gpsData.lon.toFixed(6) : (isConnected ? 'Acquiring lock...' : 'Waiting for BLE...')}
              </strong>
            </div>

            {gpsData?.mapsUrl && (
              <a
                href={gpsData.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 pt-1 font-sans underline"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Verify Location in Google Maps
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 block flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-600" />
              Satellite Lock Tip:
            </span>
            <p>• Neo-6M TX → <strong>GPIO 18</strong> | RX → <strong>GPIO 17</strong></p>
            <p>• Module antenna must have clear view of sky (place near an open window).</p>
            <p className="text-[10px] text-emerald-700 pt-0.5">
              • The tiny green/blue LED on the Neo-6M module will start <strong>blinking</strong> once a satellite fix is locked (1–3 min).
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
