import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, Play, Square, RotateCcw, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { bleAdapter } from '../../services/ble/adapter';
import { BleConnectionStatus, BleDeviceInfo, BlePacket } from '../../types/ble';

interface ECGMonitorViewProps {
  bleStatus: BleConnectionStatus;
  sampleCount: number;
  onSampleCountChange: (count: number | ((prev: number) => number)) => void;
}

export const ECGMonitorView: React.FC<ECGMonitorViewProps> = ({
  bleStatus,
  sampleCount,
  onSampleCountChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState<BleDeviceInfo | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [gainMv, setGainMv] = useState<number>(1.0);
  const [sweepSpeed, setSweepSpeed] = useState<number>(25);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<number[]>([]);
  const sweepPosRef = useRef<number>(0);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy
    }
  };

  // Subscribe to live BLE stream
  useEffect(() => {
    const unsubData = bleAdapter.onData((packet: BlePacket) => {
      if (!isDemoMode && isRunning) {
        bufferRef.current.push(packet.voltageMv);
        onSampleCountChange((prev) => prev + 1);
        if (packet.rawSample && packet.rawSample > 40 && packet.rawSample < 200) {
          playBeep();
        }
      }
    });

    return () => unsubData();
  }, [isDemoMode, isRunning, soundEnabled]);

  // Main 60 FPS Sweep Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = 360 * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const pointsWidth = Math.floor(canvas.width / window.devicePixelRatio);
    const traceBuffer = new Float32Array(pointsWidth);

    let simPhase = 0;
    let lastQrsTime = 0;

    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Calibrated Paper Grid
      ctx.lineWidth = 0.5;
      const mmMajor = 25;
      const mmMinor = 5;

      ctx.strokeStyle = 'rgba(225, 29, 72, 0.08)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += mmMinor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += mmMinor) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(225, 29, 72, 0.22)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += mmMajor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += mmMajor) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Sample generation / consumption
      if (isRunning) {
        const stepRate = Math.max(1, Math.round((sweepSpeed / 25) * 2));

        for (let s = 0; s < stepRate; s++) {
          let voltage = 0;

          if (isDemoMode) {
            simPhase += 0.016 * (72 / 60);
            const cycle = simPhase % 1.0;

            if (cycle >= 0.12 && cycle < 0.22) {
              voltage = 0.18 * Math.sin(((cycle - 0.12) / 0.10) * Math.PI);
            } else if (cycle >= 0.30 && cycle < 0.33) {
              voltage = -0.18 * Math.sin(((cycle - 0.30) / 0.03) * Math.PI);
            } else if (cycle >= 0.33 && cycle < 0.38) {
              voltage = 1.35 * Math.sin(((cycle - 0.33) / 0.05) * Math.PI);
              if (cycle - (simPhase - 0.016 * (72 / 60)) % 1.0 > 0 && performance.now() - lastQrsTime > 400) {
                lastQrsTime = performance.now();
                playBeep();
              }
            } else if (cycle >= 0.38 && cycle < 0.43) {
              voltage = -0.42 * Math.sin(((cycle - 0.38) / 0.05) * Math.PI);
            } else if (cycle >= 0.55 && cycle < 0.75) {
              voltage = 0.32 * Math.sin(((cycle - 0.55) / 0.20) * Math.PI);
            } else {
              voltage = (Math.random() - 0.5) * 0.02;
            }
            onSampleCountChange((prev) => prev + 1);
          } else if (bufferRef.current.length > 0) {
            voltage = bufferRef.current.shift() || 0;
          } else {
            voltage = 0; // Flat resting baseline when no device is streaming
          }

          sweepPosRef.current = (sweepPosRef.current + 1) % w;
          traceBuffer[sweepPosRef.current] = voltage;
        }
      }

      // Draw Trace with Sweep Erase Gap
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#0284c7';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const currentHead = sweepPosRef.current;
      const eraseGap = 20;

      ctx.beginPath();
      let isFirst = true;
      for (let x = 0; x < w; x++) {
        const distToHead = (x - currentHead + w) % w;
        if (distToHead > 0 && distToHead < eraseGap) {
          isFirst = true;
          continue;
        }

        const v = traceBuffer[x] * gainMv;
        const y = midY - v * 60;

        if (isFirst) {
          ctx.moveTo(x, y);
          isFirst = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Glowing Sweep Cursor
      if (isRunning && (isDemoMode || bleStatus === 'connected')) {
        const headY = midY - (traceBuffer[currentHead] * gainMv) * 60;
        ctx.beginPath();
        ctx.arc(currentHead, headY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning, isDemoMode, gainMv, sweepSpeed, bleStatus, soundEnabled]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const dev = await bleAdapter.connect();
      setDeviceInfo(dev);
      setIsDemoMode(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User cancelled')) {
        setErrorMessage('Device selection was cancelled.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await bleAdapter.disconnect();
      setDeviceInfo(null);
    } catch {
      // Disconnect error
    }
  };

  const handleClear = () => {
    bufferRef.current = [];
    sweepPosRef.current = 0;
    onSampleCountChange(0);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Real-Time ECG Monitoring</h1>
          <p className="text-xs text-slate-500 mt-1">
            Single-lead biopotential stream calibrated to standard 25 mm/s and 10 mm/mV paper scale.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {bleStatus === 'connected' ? (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition-all"
            >
              Disconnect Sensor
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
            >
              <Bluetooth className="w-4 h-4" />
              <span>{isConnecting ? 'Searching for Sensor...' : 'Connect ECG Sensor'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Waveform Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1.5 font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all ${
                isRunning
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              onClick={handleClear}
              className="px-3 py-1.5 font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-sky-50 text-sky-700 border-sky-300'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
              title={soundEnabled ? 'Mute QRS tone' : 'Enable QRS tone'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">Stream Mode:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
              <button
                onClick={() => setIsDemoMode(false)}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                  !isDemoMode ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Hardware
              </button>
              <button
                onClick={() => setIsDemoMode(true)}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                  isDemoMode ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demonstration
              </button>
            </div>
          </div>

          {/* Gain and Sweep */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Gain:</span>
              <select
                value={gainMv}
                onChange={(e) => setGainMv(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 text-xs font-mono"
              >
                <option value={0.5}>0.5x (5 mm/mV)</option>
                <option value={1.0}>1.0x (10 mm/mV)</option>
                <option value={1.5}>1.5x (15 mm/mV)</option>
                <option value={2.0}>2.0x (20 mm/mV)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Sweep:</span>
              <select
                value={sweepSpeed}
                onChange={(e) => setSweepSpeed(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 text-xs font-mono"
              >
                <option value={12.5}>12.5 mm/s</option>
                <option value={25}>25 mm/s</option>
                <option value={50}>50 mm/s</option>
              </select>
            </div>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative bg-ecg-grid">
          <canvas ref={canvasRef} className="w-full block" style={{ height: '360px' }} />

          {/* Empty Overlay when Disconnected */}
          {!isDemoMode && bleStatus === 'disconnected' && sampleCount === 0 && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Bluetooth className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">No Sensor Connected</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                Connect your Bluetooth ECG sensor to stream live cardiac signals, or switch to Demonstration Mode to preview the waveform canvas.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs shadow-xs"
                >
                  Pair Sensor
                </button>
                <button
                  onClick={() => setIsDemoMode(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                >
                  Try Demo Signal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div>
            <span>Channel: Lead II Reference</span>
            <span className="mx-2">•</span>
            <span>25 mm/s, 10 mm/mV</span>
          </div>

          <div className="font-mono">
            {isDemoMode
              ? 'Mode: Analytical Demo Signal (72 BPM)'
              : bleStatus === 'connected'
              ? `Sensor: ${deviceInfo?.name || 'Active Stream'} (${sampleCount.toLocaleString()} samples)`
              : 'Status: Disconnected'}
          </div>
        </div>
      </div>
    </div>
  );
};
