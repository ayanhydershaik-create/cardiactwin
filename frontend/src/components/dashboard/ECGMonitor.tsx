import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bluetooth, Info, Play, RotateCcw, Square, Volume2, VolumeX, Zap } from 'lucide-react';
import { bleAdapter } from '../../services/ble/adapter';
import { BleConnectionStatus, BlePacket } from '../../types/ble';

export const ECGMonitor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [bleStatus, setBleStatus] = useState<BleConnectionStatus>(bleAdapter.getStatus());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [simulatedBpm, setSimulatedBpm] = useState<number>(72);
  const [gainMv, setGainMv] = useState<number>(1.0); // 1.0x gain = 10mm/mV
  const [sweepSpeed, setSweepSpeed] = useState<number>(25); // 25mm/s standard

  // Audio Beep context
  const audioCtxRef = useRef<AudioContext | null>(null);

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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz standard QRS beep
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy blocked
    }
  };

  // Circular signal buffer for canvas rendering
  const bufferRef = useRef<number[]>([]);
  const sweepPosRef = useRef<number>(0);

  // Subscribe to real BLE stream
  useEffect(() => {
    const unsub = bleAdapter.onStatusChange((status) => {
      setBleStatus(status);
      if (status === 'connected') {
        setIsSimulated(false); // Prefer real device if connected
      }
    });

    const unsubData = bleAdapter.onData((packet: BlePacket) => {
      if (!isSimulated && isRunning) {
        bufferRef.current.push(packet.voltageMv);
        setSampleCount((prev) => prev + 1);
        if (packet.rawSample && packet.rawSample > 40 && packet.rawSample < 200) {
          setSimulatedBpm(packet.rawSample);
          playBeep();
        }
      }
    });

    return () => {
      unsub();
      unsubData();
    };
  }, [isSimulated, isRunning, soundEnabled]);

  // Main Canvas Rendering Loop (60 FPS with Sweep Erase Line)
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
    for (let i = 0; i < pointsWidth; i++) {
      traceBuffer[i] = 0;
    }

    let simPhase = 0;
    let lastQrsTime = 0;

    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw High-Precision Medical Grid (Red/Pink Calibrated Paper)
      ctx.lineWidth = 0.5;
      const mmMajor = 25; // 25px per 0.20 sec major block
      const mmMinor = 5;  // 5px per 0.04 sec minor square

      // Minor grid
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

      // Major grid
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

      // 2. Compute Next Voltage Sample
      if (isRunning) {
        const stepRate = Math.max(1, Math.round((sweepSpeed / 25) * 2));

        for (let s = 0; s < stepRate; s++) {
          let voltage = 0;

          if (isSimulated) {
            // Analytical P-Q-R-S-T generator at 360 Hz
            simPhase += 0.016 * (simulatedBpm / 60);
            const cycle = simPhase % 1.0;

            if (cycle >= 0.12 && cycle < 0.22) {
              voltage = 0.18 * Math.sin(((cycle - 0.12) / 0.10) * Math.PI);
            } else if (cycle >= 0.30 && cycle < 0.33) {
              voltage = -0.18 * Math.sin(((cycle - 0.30) / 0.03) * Math.PI);
            } else if (cycle >= 0.33 && cycle < 0.38) {
              voltage = 1.35 * Math.sin(((cycle - 0.33) / 0.05) * Math.PI);
              if (cycle - (simPhase - 0.016 * (simulatedBpm / 60)) % 1.0 > 0 && performance.now() - lastQrsTime > 400) {
                lastQrsTime = performance.now();
                playBeep();
              }
            } else if (cycle >= 0.38 && cycle < 0.43) {
              voltage = -0.42 * Math.sin(((cycle - 0.38) / 0.05) * Math.PI);
            } else if (cycle >= 0.55 && cycle < 0.75) {
              voltage = 0.32 * Math.sin(((cycle - 0.55) / 0.20) * Math.PI);
            } else {
              voltage = (Math.random() - 0.5) * 0.02; // Small baseline noise
            }

            setSampleCount((prev) => prev + 1);
          } else if (bufferRef.current.length > 0) {
            voltage = bufferRef.current.shift() || 0;
          } else {
            voltage = 0; // Flat baseline when disconnected
          }

          // Advance sweep cursor
          sweepPosRef.current = (sweepPosRef.current + 1) % w;
          traceBuffer[sweepPosRef.current] = voltage;
        }
      }

      // 3. Render ECG Waveform with Sweep Gap
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
        const y = midY - v * 60; // 60px = 1 mV standard scaling

        if (isFirst) {
          ctx.moveTo(x, y);
          isFirst = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 4. Draw Sweep Head Indicator
      if (isRunning && (isSimulated || bleStatus === 'connected')) {
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
  }, [isRunning, isSimulated, simulatedBpm, gainMv, sweepSpeed, bleStatus, soundEnabled]);

  const handleClear = () => {
    bufferRef.current = [];
    sweepPosRef.current = 0;
    setSampleCount(0);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Telemetry Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Real-Time ECG Waveform Monitor</h1>
            {isSimulated ? (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Simulated Demonstration Mode</span>
              </span>
            ) : bleStatus === 'connected' ? (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1">
                <Bluetooth className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Hardware Sensor Connected</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 rounded-full">
                Hardware Disconnected (Flat Baseline)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard Lead MLII single-channel telemetry (360 Hz sample rate standard, calibrated 25 mm/s paper grid).
          </p>
        </div>

        {/* Telemetry quick metrics */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-2xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Heart Rate</span>
            <span className="text-base font-extrabold text-slate-900 font-mono">
              {isSimulated || bleStatus === 'connected' ? `${simulatedBpm} BPM` : '—'}
            </span>
          </div>
          <div className="border-l border-slate-200 pl-3 sm:pl-4">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Buffer Samples</span>
            <span className="text-base font-extrabold text-slate-900 font-mono">
              {sampleCount.toLocaleString()}
            </span>
          </div>
          <div className="border-l border-slate-200 pl-3 sm:pl-4">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Paper Calibration</span>
            <span className="text-xs font-semibold text-slate-700 font-mono">
              25 mm/s • 10 mm/mV
            </span>
          </div>
        </div>
      </div>

      {/* Main Waveform Canvas Container */}
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
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume Stream</span>
                </>
              )}
            </button>

            <button
              onClick={handleClear}
              className="px-3 py-1.5 font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Trace</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-sky-50 text-sky-700 border-sky-300'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
              title={soundEnabled ? 'Mute QRS sound' : 'Enable QRS beep sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Mode Switcher: Real BLE vs Simulated Demonstration */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Input Source:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-2xs">
              <button
                onClick={() => setIsSimulated(false)}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                  !isSimulated
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hardware Sensor
              </button>
              <button
                onClick={() => setIsSimulated(true)}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                  isSimulated
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Simulated Demo
              </button>
            </div>
          </div>

          {/* Calibrations: Gain & Speed */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Gain:</span>
              <select
                value={gainMv}
                onChange={(e) => setGainMv(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-mono text-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value={0.5}>0.5x (5 mm/mV)</option>
                <option value={1.0}>1.0x (10 mm/mV)</option>
                <option value={1.5}>1.5x (15 mm/mV)</option>
                <option value={2.0}>2.0x (20 mm/mV)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Sweep:</span>
              <select
                value={sweepSpeed}
                onChange={(e) => setSweepSpeed(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 font-mono text-xs focus:ring-1 focus:ring-sky-500"
              >
                <option value={12.5}>12.5 mm/s</option>
                <option value={25}>25 mm/s</option>
                <option value={50}>50 mm/s</option>
              </select>
            </div>
          </div>
        </div>

        {/* The High-Resolution Canvas with ECG Grid Paper */}
        <div className="relative bg-ecg-grid">
          <canvas
            ref={canvasRef}
            className="w-full block"
            style={{ height: '360px' }}
          />

          {/* Empty state overlay when disconnected and not simulated */}
          {!isSimulated && bleStatus === 'disconnected' && sampleCount === 0 && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Bluetooth className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">No ECG Sensor Connected</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                Live streaming requires a connected wireless biopotential device. You can pair a device under 
                Sensor Hardware or activate Simulated Demo Mode to test waveform rendering.
              </p>
              <button
                onClick={() => setIsSimulated(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Enable Simulated Demonstration Waveform</span>
              </button>
            </div>
          )}
        </div>

        {/* Canvas Footer Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Channel 1: Lead II (MLII Standard)</span>
            <span className="text-slate-300">•</span>
            <span>Bandpass: 0.05 Hz – 150 Hz</span>
          </div>

          <div className="font-mono text-[11px]">
            {isSimulated ? (
              <span className="text-amber-700 font-semibold">Source: Synthetic Demonstration Generator (360 Hz)</span>
            ) : (
              <span>Telemetry Hardware: {bleStatus}</span>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Simulation Disclaimer when in Simulated Mode */}
      {isSimulated && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
              Notice: Simulated Demonstration Signal Active:
            </span>
            <p className="leading-relaxed text-amber-800/90">
              The currently displayed waveform is synthetically generated by an in-browser analytical mathematical model for 
              interface validation. It does not represent data from a human subject or live biopotential hardware. 
              Physical telemetry requires pairing an external sensor in the <strong>Sensor Hardware</strong> tab.
            </p>
          </div>
        </div>
      )}

      {/* Information Box regarding ECG Lead Placement */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-800">Modified Lead II (MLII) Clinical Reference:</span>
          <p className="leading-relaxed text-slate-500">
            Lead II measures the potential difference between right arm and left leg, aligning with the electrical axis of ventricular 
            depolarization. At 25 mm/s sweep speed, each small grid square (1 mm) represents 40 milliseconds, and each large square (5 mm) 
            represents 200 milliseconds.
          </p>
        </div>
      </div>
    </div>
  );
};
