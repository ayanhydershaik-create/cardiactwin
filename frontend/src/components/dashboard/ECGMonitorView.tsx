import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  Bluetooth,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { bleAdapter } from '../../services/ble/adapter';
import { BleConnectionStatus, BleDeviceInfo, BlePacket } from '../../types/ble';

interface ECGMonitorViewProps {
  bleStatus: BleConnectionStatus;
  sampleCount: number;
  onSampleCountChange: (count: number | ((prev: number) => number)) => void;
  onRecordResult?: (prediction: any, label: string) => void;
}

export interface RecordedSession {
  id: string;
  timestamp: string;
  predictedClass: string;
  assessment: 'GOOD (Normal Sinus Rhythm)' | 'ATTENTION (Ventricular Ectopic)' | 'ATTENTION (Supraventricular)' | 'ARTIFACT / PACED';
  isGood: boolean;
  probabilities: Record<string, number>;
  avgHeartRate: number;
  spo2: number;
  ecgSnippet?: number[];
  sampleCount: number;
  report: string;
}

const STORAGE_KEY = 'cardiac_twin_10min_history';

// ── SVG Mini Waveform Thumbnail for History Cards ─────────────────────────
const MiniECGChart: React.FC<{ data?: number[]; isGood: boolean }> = ({ data, isGood }) => {
  if (!data || data.length === 0) {
    return <div className="h-10 w-28 bg-slate-100 rounded-md flex items-center justify-center text-[9px] text-slate-400 font-mono">No Waveform</div>;
  }

  const width = 120;
  const height = 40;
  const midY = height / 2;
  const step = width / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = Math.max(3, Math.min(height - 3, midY - v * 12));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const strokeColor = isGood ? '#059669' : '#e11d48';

  return (
    <div className="bg-slate-900/90 rounded-lg p-1 shadow-2xs border border-slate-800">
      <svg width={width} height={height} className="overflow-visible block">
        <line x1="0" y1={midY} x2={width} y2={midY} stroke="rgba(255,255,255,0.15)" strokeDasharray="2,2" strokeWidth="0.8" />
        <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    </div>
  );
};

// ── SVG Trend Chart for Real-Time SpO2 & Heart Rate ───────────────────────
const TelemetryTrendChart: React.FC<{
  data: number[];
  minVal: number;
  maxVal: number;
  strokeColor: string;
  gradientId: string;
  fromColor: string;
  toColor: string;
  unit: string;
  targetLine?: number;
}> = ({ data, minVal, maxVal, strokeColor, gradientId, fromColor, toColor, targetLine }) => {
  const width = 360;
  const height = 75;

  const displayData = data.length >= 2 ? data : [minVal, ...data, maxVal];
  const step = width / (displayData.length - 1 || 1);
  const range = maxVal - minVal || 1;

  const points = displayData.map((v, i) => {
    const x = i * step;
    const norm = Math.max(0, Math.min(1, (v - minVal) / range));
    const y = height - norm * (height - 14) - 7;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const areaStr = `0,${height} ${polylineStr} ${width},${height}`;

  const lastVal = data[data.length - 1] ?? 0;
  const lastX = width;
  const lastNorm = Math.max(0, Math.min(1, (lastVal - minVal) / range));
  const lastY = height - lastNorm * (height - 14) - 7;

  const targetY = targetLine ? height - Math.max(0, Math.min(1, (targetLine - minVal) / range)) * (height - 14) - 7 : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fromColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={toColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Target reference guideline */}
      {targetY !== null && (
        <line x1="0" y1={targetY} x2={width} y2={targetY} stroke="rgba(148, 163, 184, 0.4)" strokeDasharray="3,3" strokeWidth="1" />
      )}

      {/* Filled Area */}
      <polygon points={areaStr} fill={`url(#${gradientId})`} />

      {/* Trend Stroke Line */}
      <polyline fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={polylineStr} />

      {/* Current Pulse Pip */}
      {data.length > 0 && (
        <circle cx={lastX} cy={lastY} r="4" fill={strokeColor} stroke="#ffffff" strokeWidth="2" className="animate-pulse" />
      )}
    </svg>
  );
};

export const ECGMonitorView: React.FC<ECGMonitorViewProps> = ({
  bleStatus,
  sampleCount,
  onSampleCountChange,
  onRecordResult,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [deviceInfo, setDeviceInfo] = useState<BleDeviceInfo | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [gainMv, setGainMv] = useState<number>(2.5); // Default to 2.5x for prominent hospital-grade amplitude
  const [sweepSpeed, setSweepSpeed] = useState<number>(25);
  const [displayMode, setDisplayMode] = useState<'middle-flow' | 'sweep'>('middle-flow');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<BlePacket | null>(null);

  // Real-Time Trend History (Rolling 30-sample array for SVG area charts)
  const [spo2Trend, setSpo2Trend] = useState<number[]>([98, 98, 97, 98, 98, 99, 98]);
  const [hrTrend, setHrTrend] = useState<number[]>([72, 73, 71, 74, 72, 73, 72]);
  const lastTrendUpdateRef = useRef<number>(0);

  // 2-3 Minute Automated Session Recording & AI Analysis (Default: 120s / 2 Minutes, Configurable to 180s / 3 Minutes)
  const [sessionIntervalSeconds, setSessionIntervalSeconds] = useState<number>(120);
  const [autoRecordSeconds, setAutoRecordSeconds] = useState<number>(120);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [sessionHistory, setSessionHistory] = useState<RecordedSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeReportModal, setActiveReportModal] = useState<RecordedSession | null>(null);

  // Buffer holding recent raw voltages for 234-sample window slicing
  const recentVoltagesRef = useRef<number[]>([]);

  // Persistent Canvas trace buffer (never reset on re-render)
  const traceBufferRef = useRef<Float32Array | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<number[]>([]);
  const sweepPosRef = useRef<number>(0);
  const lastInterpolatedTargetRef = useRef<number>(0);
  const lastRenderedVoltageRef = useRef<number>(0);

  // Save session history to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionHistory));
    } catch {
      // Storage quota or private browsing
    }
  }, [sessionHistory]);

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

  // ── Trigger 10-Minute ML Analysis & AI Report ────────────────────────────
  const triggerSessionAnalysis = useCallback(async () => {
    // Collect voltages from component ref or BLE adapter rolling window
    let availableVoltages = recentVoltagesRef.current;
    if (availableVoltages.length < 30) {
      availableVoltages = bleAdapter.getRecentVoltages(234);
    }

    setIsAnalyzing(true);
    try {
      const rawWindow = availableVoltages.slice(-234);
      let features: number[] = [];

      if (rawWindow.length >= 234) {
        features = rawWindow.slice(-234);
      } else {
        const src = rawWindow.length > 0 ? rawWindow : Array(50).fill(0).map((_, i) => Math.sin(i / 5) * 0.5);
        for (let i = 0; i < 234; i++) {
          const idx = Math.min(src.length - 1, Math.floor((i / 234) * src.length));
          features.push(src[idx] || 0);
        }
      }

      features = features.map((v) => (Number.isFinite(v) ? v : 0.0));

      const res = await fetch('/api/agent/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features,
          avg_hr: latestTelemetry?.heartRate && latestTelemetry.heartRate > 0 ? latestTelemetry.heartRate : 72.0,
          sample_count: sampleCount,
        }),
      });

      if (!res.ok) {
        throw new Error(`Inference API error: ${res.statusText}`);
      }

      const data = await res.json();
      const predClass = data.prediction?.predicted_class || 'N';
      let assessment: RecordedSession['assessment'] = 'GOOD (Normal Sinus Rhythm)';
      let isGood = true;

      if (predClass === 'V') {
        assessment = 'ATTENTION (Ventricular Ectopic)';
        isGood = false;
      } else if (predClass === 'S') {
        assessment = 'ATTENTION (Supraventricular)';
        isGood = false;
      } else if (predClass === 'Q') {
        assessment = 'ARTIFACT / PACED';
        isGood = false;
      }

      const curSpo2 = latestTelemetry?.spo2 && latestTelemetry.spo2 > 0 ? latestTelemetry.spo2 : (latestTelemetry?.irValue && latestTelemetry.irValue > 0 && latestTelemetry.irValue <= 100 ? latestTelemetry.irValue : 98);
      const curHr = latestTelemetry?.heartRate && latestTelemetry.heartRate > 0 ? latestTelemetry.heartRate : 72.0;

      const newSession: RecordedSession = {
        id: `sess-${Date.now()}`,
        timestamp: new Date().toISOString(),
        predictedClass: predClass,
        assessment,
        isGood,
        probabilities: data.prediction?.class_probabilities || {},
        avgHeartRate: curHr,
        spo2: curSpo2,
        ecgSnippet: features.slice(-120),
        sampleCount,
        report: data.report || `${Math.round(sessionIntervalSeconds / 60)}-minute ECG telemetry session classified and archived.`,
      };

      setSessionHistory((prev) => [newSession, ...prev]);

      // Propagate to global session results for the ResultsView and HomeView
      if (onRecordResult && data.prediction) {
        onRecordResult(data.prediction, `Live Snapshot (${predClass}) - ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error('Session analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
      setAutoRecordSeconds(sessionIntervalSeconds); // Reset countdown to chosen interval
    }
  }, [latestTelemetry, sampleCount, isDemoMode, sessionIntervalSeconds]);

  // ── 2-3 Minute Auto-Recording Countdown Timer ────────────────────────────
  useEffect(() => {
    if (bleStatus !== 'connected' && !isDemoMode) return;

    const timer = setInterval(() => {
      setAutoRecordSeconds((prev) => {
        if (prev <= 1) {
          triggerSessionAnalysis();
          return sessionIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bleStatus, isDemoMode, triggerSessionAnalysis, sessionIntervalSeconds]);

  // ── Subscribe to Live BLE Telemetry Stream ────────────────────────────────
  useEffect(() => {
    const unsubData = bleAdapter.onData((packet: BlePacket) => {
      setLatestTelemetry(packet);

      // Periodically update SpO2 & Heart Rate trend series for the live charts (every ~1s)
      const now = performance.now();
      if (now - lastTrendUpdateRef.current >= 1000) {
        lastTrendUpdateRef.current = now;
        const curSpO2 = packet.spo2 && packet.spo2 > 0 ? packet.spo2 : (packet.irValue && packet.irValue > 0 && packet.irValue <= 100 ? packet.irValue : null);
        if (curSpO2) {
          setSpo2Trend((prev) => [...prev.slice(-29), curSpO2]);
        }
        if (packet.heartRate && packet.heartRate > 0) {
          setHrTrend((prev) => [...prev.slice(-29), Math.round(packet.heartRate!)]);
        }
      }

      if (!isDemoMode && isRunning) {
        // When electrodes are not attached to skin, force voltage to 0.0 mV (isoelectric middle line)
        const effectiveVoltage = packet.leadsOff ? 0.0 : packet.voltageMv;
        recentVoltagesRef.current.push(effectiveVoltage);
        if (recentVoltagesRef.current.length > 6000) {
          recentVoltagesRef.current.shift();
        }

        if (packet.samples && packet.samples.length > 0) {
          for (const s of packet.samples) {
            bufferRef.current.push(packet.leadsOff ? 0.0 : s);
          }
          onSampleCountChange((prev) => prev + packet.samples!.length);
        } else {
          // Linear/Cosine interpolation across incoming telemetry packets
          const prev = lastInterpolatedTargetRef.current;
          const target = effectiveVoltage;
          lastInterpolatedTargetRef.current = target;

          const steps = 4;
          for (let i = 1; i <= steps; i++) {
            const frac = i / steps;
            const eased = (1 - Math.cos(frac * Math.PI)) / 2;
            const val = prev + (target - prev) * eased;
            bufferRef.current.push(val);
          }
          onSampleCountChange((prev) => prev + 1);
        }

        if (packet.rawSample && packet.rawSample > 40 && packet.rawSample < 200) {
          playBeep();
        }
      }
    });

    return () => unsubData();
  }, [isDemoMode, isRunning, soundEnabled, onSampleCountChange]);

  // ── Main 60 FPS Sweep & Middle Flow Canvas Loop ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelWidth = Math.floor(rect.width * window.devicePixelRatio);
      const pixelHeight = Math.floor(360 * window.devicePixelRatio);
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const pointsWidth = Math.floor(canvas.width / window.devicePixelRatio);
      if (!traceBufferRef.current || traceBufferRef.current.length !== pointsWidth) {
        traceBufferRef.current = new Float32Array(pointsWidth);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let simPhase = 0;
    let lastQrsTime = 0;

    const render = () => {
      const w = Math.floor(canvas.width / window.devicePixelRatio);
      const h = Math.floor(canvas.height / window.devicePixelRatio);
      const midY = Math.floor(h / 2);

      ctx.clearRect(0, 0, w, h);

      // Calibrated Paper Grid (25 mm/s, 10 mm/mV)
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

      // Isoelectric Dotted Center Reference Line (Middle Line — matches OLED ISOELECTRIC_Y = 38)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.restore();

      // Sample Consumption
      if (isRunning) {
        const stepRate = isDemoMode
          ? Math.max(1, Math.round((sweepSpeed / 25) * 2))
          : Math.max(1, Math.min(8, Math.round(bufferRef.current.length / 5) || 1));

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
            recentVoltagesRef.current.push(voltage);

            // In demo mode update trend series periodically
            if (performance.now() - lastTrendUpdateRef.current >= 1000) {
              lastTrendUpdateRef.current = performance.now();
              setSpo2Trend((prev) => [...prev.slice(-29), 98 + Math.floor(Math.sin(performance.now() / 4000) * 1.2)]);
              setHrTrend((prev) => [...prev.slice(-29), Math.round(72 + Math.sin(performance.now() / 5000) * 3)]);
            }
          } else if (bufferRef.current.length > 0) {
            voltage = bufferRef.current.shift()!;
            if (latestTelemetry?.leadsOff) {
              voltage = 0.0;
            }
            lastRenderedVoltageRef.current = voltage;
          } else {
            voltage = latestTelemetry?.leadsOff ? 0.0 : lastRenderedVoltageRef.current;
          }

          if (displayMode === 'middle-flow') {
            // Continuous strip chart: shift left by 1 and append at right edge
            if (traceBufferRef.current && traceBufferRef.current.length === w) {
              traceBufferRef.current.copyWithin(0, 1);
              traceBufferRef.current[w - 1] = voltage;
            }
          } else {
            // Oscilloscope Sweep Mode
            sweepPosRef.current = (sweepPosRef.current + 1) % w;
            if (traceBufferRef.current && sweepPosRef.current < traceBufferRef.current.length) {
              traceBufferRef.current[sweepPosRef.current] = voltage;
            }
          }
        }
      }

      // Drawing Waveform:
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#0284c7';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const buf = traceBufferRef.current;
      const drawLimit = buf ? Math.min(w, buf.length) : w;

      if (displayMode === 'middle-flow' && buf) {
        // Continuous Middle Flow: waveform flows continuously across the center
        ctx.beginPath();
        let started = false;
        for (let x = 0; x < drawLimit; x++) {
          const rawV = buf[x];
          const v = Number.isFinite(rawV) ? Math.max(-2.5, Math.min(2.5, rawV)) : 0;
          const y = Math.max(12, Math.min(h - 12, midY - v * gainMv * 45));
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Glowing live intake pip at right edge
        if (isRunning && (isDemoMode || bleStatus === 'connected')) {
          const lastV = buf[drawLimit - 1] || 0;
          const headY = Math.max(12, Math.min(h - 12, midY - lastV * gainMv * 45));
          ctx.beginPath();
          ctx.arc(drawLimit - 2, headY, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#0284c7';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (buf) {
        // Oscilloscope 2-Segment Sweep
        const currentHead = Math.min(drawLimit - 1, Math.max(0, Math.floor(sweepPosRef.current)));
        const eraseGap = 20;

        // Segment 1: Ahead of cursor
        ctx.beginPath();
        let started = false;
        for (let x = currentHead + eraseGap; x < drawLimit; x++) {
          const rawV = buf[x];
          const v = Number.isFinite(rawV) ? Math.max(-2.5, Math.min(2.5, rawV)) : 0;
          const y = Math.max(12, Math.min(h - 12, midY - v * gainMv * 45));
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Segment 2: Behind cursor
        ctx.beginPath();
        started = false;
        for (let x = 0; x <= currentHead; x++) {
          const rawV = buf[x];
          const v = Number.isFinite(rawV) ? Math.max(-2.5, Math.min(2.5, rawV)) : 0;
          const y = Math.max(12, Math.min(h - 12, midY - v * gainMv * 45));
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Sweep Cursor
        if (isRunning && (isDemoMode || bleStatus === 'connected')) {
          const headV = buf[currentHead] || 0;
          const headY = Math.max(12, Math.min(h - 12, midY - headV * gainMv * 45));
          ctx.beginPath();
          ctx.arc(currentHead, headY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#0284c7';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning, isDemoMode, gainMv, sweepSpeed, displayMode, bleStatus, soundEnabled, onSampleCountChange]);

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
    if (traceBufferRef.current) {
      traceBufferRef.current.fill(0);
    }
    onSampleCountChange(0);
  };

  const handleClearHistory = () => {
    setSessionHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Top Header ── */}
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

      {/* iOS / Unsupported Browser Warning for Web Bluetooth */}
      {bleStatus === 'unsupported' && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
            Bluetooth ECG Acquisition Not Supported in This Browser
          </div>
          <p className="leading-relaxed">
            Web Bluetooth is not available on this device or browser. This is a known limitation of <strong>Apple iOS Safari, Chrome for iOS, and Firefox</strong> on all platforms.
          </p>
          <div className="pt-1 space-y-1">
            <p className="font-semibold text-orange-800">Supported platforms for live ECG streaming:</p>
            <ul className="list-disc list-inside space-y-0.5 text-orange-800">
              <li>Google Chrome (Windows, macOS, Android)</li>
              <li>Microsoft Edge (Windows, macOS, Android)</li>
              <li>Samsung Internet (Android)</li>
            </ul>
          </div>
          <p className="text-orange-700 mt-1">
            You can still use <strong>Demonstration Mode</strong> below to explore the full ECG interface without a live sensor.
          </p>
        </div>
      )}

      {/* ── Fixed-Height, Zero-Shift Live Hardware Status Banner ── */}
      {(bleStatus === 'connected' || sampleCount > 0) && (
        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
            {/* Left Hardware Identifier */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                <Bluetooth className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-emerald-950">
                    {deviceInfo?.name || 'CARDIAC_TWIN'}
                  </h3>
                  <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded font-bold text-[9px]">
                    CONNECTED
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700 font-mono">
                  Packets: {sampleCount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Right Metric Badges */}
            <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
              <div className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border ${
                latestTelemetry?.leadsOff 
                  ? 'bg-amber-100 text-amber-900 border-amber-300' 
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                {latestTelemetry?.leadsOff ? '⚠️ Attach 3 Electrodes' : '🟢 Leads On Skin'}
              </div>

              <div className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg font-bold text-slate-800 shadow-2xs min-w-[125px] text-center">
                ADC: <span className="text-sky-600 tabular-nums">{latestTelemetry?.ecgRaw ?? '--'}</span> / 4095
              </div>

              <div className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg font-bold text-slate-800 shadow-2xs min-w-[90px] text-center">
                HR:{' '}
                <span className="text-rose-600 tabular-nums">
                  {latestTelemetry?.heartRate && latestTelemetry.heartRate > 0
                    ? `${latestTelemetry.heartRate.toFixed(0)} BPM`
                    : '--'}
                </span>
              </div>

              <div className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg font-bold text-slate-800 shadow-2xs min-w-[125px] text-center">
                SpO₂:{' '}
                <span className="text-purple-600 tabular-nums">
                  {latestTelemetry?.spo2 && latestTelemetry.spo2 > 0
                    ? `${latestTelemetry.spo2}% (O₂)`
                    : (latestTelemetry?.irValue && latestTelemetry.irValue > 0 && latestTelemetry.irValue <= 100
                        ? `${latestTelemetry.irValue}% (O₂)`
                        : 'No Finger')}
                </span>
              </div>

              {/* 10-Minute Snapshot Trigger */}
              <button
                onClick={triggerSessionAnalysis}
                disabled={isAnalyzing}
                className="px-3 py-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-lg font-sans font-semibold text-[11px] shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Capture current window and run AI + ML Clinical Assessment"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{isAnalyzing ? 'Analyzing...' : `Snapshot (${formatTimer(autoRecordSeconds)})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Waveform Card ── */}
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

          {/* Display Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium text-[11px]">Display:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
              <button
                onClick={() => setDisplayMode('middle-flow')}
                className={`px-2 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  displayMode === 'middle-flow' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Continuous real-time ECG strip flowing smoothly through the center middle line"
              >
                Middle Flow
              </button>
              <button
                onClick={() => setDisplayMode('sweep')}
                className={`px-2 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  displayMode === 'sweep' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hospital-grade 25 mm/s moving erase-bar sweep"
              >
                Sweep
              </button>
            </div>
          </div>

          {/* Stream Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium text-[11px]">Source:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
              <button
                onClick={() => setIsDemoMode(false)}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  !isDemoMode ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Hardware
              </button>
              <button
                onClick={() => setIsDemoMode(true)}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
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
                <option value={1.5}>1.5x (Standard)</option>
                <option value={2.5}>2.5x (Recommended)</option>
                <option value={3.5}>3.5x (High)</option>
                <option value={5.0}>5.0x (Ultra High)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Speed:</span>
              <select
                value={sweepSpeed}
                onChange={(e) => setSweepSpeed(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 text-xs font-mono"
              >
                <option value={12.5}>12.5 mm/s</option>
                <option value={25}>25 mm/s (Standard)</option>
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
            <span>Channel: Lead II Reference (Middle Isoelectric Line)</span>
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

      {/* ── Real-Time Clinical Biometric Trends (Chart Level) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SpO2 Oxygenation Trend Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                O₂
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">SpO₂ Oxygen Saturation Trend</h3>
                <p className="text-[10px] text-slate-500">Continuous optical plethysmogram level</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-purple-600">
                {latestTelemetry?.spo2 && latestTelemetry.spo2 > 0 ? `${latestTelemetry.spo2}%` : (spo2Trend[spo2Trend.length - 1] ? `${spo2Trend[spo2Trend.length - 1]}%` : '98%')}
              </span>
              <span className="block text-[9px] text-emerald-600 font-semibold">Normal (≥95%)</span>
            </div>
          </div>

          <TelemetryTrendChart
            data={spo2Trend}
            minVal={85}
            maxVal={100}
            strokeColor="#9333ea"
            gradientId="spo2Grad"
            fromColor="#c084fc"
            toColor="#a855f7"
            unit="%"
            targetLine={95}
          />
        </div>

        {/* Heart Rate Trend Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                ♥
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Heart Rate Pulse Trend</h3>
                <p className="text-[10px] text-slate-500">ECG R-R interval & optical pulse fusion</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-rose-600">
                {latestTelemetry?.heartRate && latestTelemetry.heartRate > 0 ? `${Math.round(latestTelemetry.heartRate)} BPM` : (hrTrend[hrTrend.length - 1] ? `${hrTrend[hrTrend.length - 1]} BPM` : '72 BPM')}
              </span>
              <span className="block text-[9px] text-sky-600 font-semibold">Resting (60–100 BPM)</span>
            </div>
          </div>

          <TelemetryTrendChart
            data={hrTrend}
            minVal={45}
            maxVal={140}
            strokeColor="#e11d48"
            gradientId="hrGrad"
            fromColor="#fb7185"
            toColor="#e11d48"
            unit="BPM"
            targetLine={100}
          />
        </div>
      </div>

      {/* ── 2-3 Minute Recorded Sessions & AI Assessment History ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Telemetry History & AI Diagnostic Assessment
            </h2>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-semibold ml-2">
              <button
                onClick={() => {
                  setSessionIntervalSeconds(120);
                  setAutoRecordSeconds(120);
                }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  sessionIntervalSeconds === 120
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Automatically record and analyze every 2 minutes"
              >
                2 Min
              </button>
              <button
                onClick={() => {
                  setSessionIntervalSeconds(180);
                  setAutoRecordSeconds(180);
                }}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  sessionIntervalSeconds === 180
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Automatically record and analyze every 3 minutes"
              >
                3 Min
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-mono text-[11px]">
              Next Auto-Report in: <span className="font-bold text-sky-600">{formatTimer(autoRecordSeconds)}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">
              {sessionHistory.length} Record{sessionHistory.length !== 1 ? 's' : ''} Saved
            </span>
            {sessionHistory.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-slate-400 hover:text-rose-600 text-[11px] font-semibold transition-colors ml-1"
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {sessionHistory.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            <Brain className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>Every {Math.round(sessionIntervalSeconds / 60)} minutes, a complete ECG feature window is automatically classified by the ML model and evaluated by the Clinical AI.</p>
            <p className="mt-1 text-[11px] text-sky-600 font-medium">
              Click &quot;Snapshot&quot; above to capture and evaluate your current rhythm right now!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionHistory.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ${
                        sess.isGood
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {sess.isGood ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {sess.assessment}
                    </span>

                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(sess.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[10px] font-mono">
                      SpO₂: {sess.spo2}%
                    </span>

                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[10px] font-mono">
                      HR: {sess.avgHeartRate.toFixed(0)} BPM
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    AAMI Class: <strong className="text-slate-700">Class {sess.predictedClass}</strong> · Confidence: {((sess.probabilities[sess.predictedClass] || 0.92) * 100).toFixed(1)}% · Packets: {sess.sampleCount.toLocaleString()}
                  </p>
                </div>

                {/* Mini Waveform preview at chart level */}
                <div className="shrink-0 flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="block text-[9px] text-slate-400 font-mono">Rhythm Window</span>
                    <span className="text-[10px] text-slate-600 font-bold font-mono">234 Samples</span>
                  </div>
                  <MiniECGChart data={sess.ecgSnippet} isGood={sess.isGood} />
                  <button
                    onClick={() => setActiveReportModal(sess)}
                    className="px-3 py-2 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-sky-700 font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Full Clinical Report Modal ── */}
      {activeReportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Clinical AI Research Report — {new Date(activeReportModal.timestamp).toLocaleTimeString()}
                </h3>
              </div>
              <button
                onClick={() => setActiveReportModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
              {/* Telemetry Chart Banner inside Report */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Classified Cardiac Rhythm Window (Lead II Reference)</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-purple-400">SpO₂: {activeReportModal.spo2}%</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-rose-400">HR: {activeReportModal.avgHeartRate.toFixed(0)} BPM</span>
                  </div>
                </div>

                {activeReportModal.ecgSnippet && activeReportModal.ecgSnippet.length > 0 && (
                  <div className="h-24 w-full bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                    <svg viewBox="0 0 500 70" className="w-full h-full overflow-visible">
                      <line x1="0" y1="35" x2="500" y2="35" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" strokeWidth="1" />
                      <polyline
                        fill="none"
                        stroke={activeReportModal.isGood ? "#34d399" : "#f43f5e"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={activeReportModal.ecgSnippet.map((v, i) => `${(i * (500 / (activeReportModal.ecgSnippet!.length - 1 || 1))).toFixed(1)},${Math.max(4, Math.min(66, 35 - v * 20)).toFixed(1)}`).join(' ')}
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 whitespace-pre-wrap font-sans">
                {activeReportModal.report}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveReportModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ECGMonitorView;
