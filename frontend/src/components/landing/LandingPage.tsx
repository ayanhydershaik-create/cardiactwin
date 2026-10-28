import React, { useEffect, useRef } from 'react';
import { Activity, ArrowRight, ShieldCheck, Zap, Heart, CheckCircle2, Cpu, BarChart2 } from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onExploreDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onExploreDemo }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth illustrative ECG rhythm canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 160;
    };
    resize();
    window.addEventListener('resize', resize);

    // Standard P-Q-R-S-T synthesis curve
    const getPoint = (x: number) => {
      const cycle = (x % 320) / 320;
      if (cycle < 0.15) return 0;
      if (cycle >= 0.15 && cycle < 0.25) return 0.16 * Math.sin(((cycle - 0.15) / 0.10) * Math.PI); // P
      if (cycle >= 0.25 && cycle < 0.35) return 0; // PR
      if (cycle >= 0.35 && cycle < 0.38) return -0.15 * Math.sin(((cycle - 0.35) / 0.03) * Math.PI); // Q
      if (cycle >= 0.38 && cycle < 0.44) return 1.15 * Math.sin(((cycle - 0.38) / 0.06) * Math.PI); // R
      if (cycle >= 0.44 && cycle < 0.48) return -0.38 * Math.sin(((cycle - 0.44) / 0.04) * Math.PI); // S
      if (cycle >= 0.48 && cycle < 0.60) return 0; // ST
      if (cycle >= 0.60 && cycle < 0.80) return 0.24 * Math.sin(((cycle - 0.60) / 0.20) * Math.PI); // T
      return 0;
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Subtle medical grid
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.08)';
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Continuous waveform
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#0284c7';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const val = getPoint(x + offset);
        const y = midY - val * (h * 0.38);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      offset += 1.8;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between selection:bg-sky-100">
      {/* Top Navbar */}
      <nav className="border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">Cardiac Digital Twin</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenAuth('signin')}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg shadow-xs transition-all flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 flex-1">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 text-sky-600 fill-sky-600/30" />
            <span>Next-Generation Electrophysiological Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Real-time cardiac telemetry and <span className="text-sky-600">digital twin analysis</span>.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Connect compatible ECG sensors, visualize medical-grade waveforms in real time, and evaluate 
            individual heartbeats using machine-learning pattern recognition.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto px-6 py-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-sky-600/15 transition-all flex items-center justify-center gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreDemo}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Explore Interactive Workspace</span>
            </button>
          </div>
        </div>

        {/* Live Rhythm Canvas Preview */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">
                Lead II Waveform Visualization (Calibrated 25 mm/s Paper Standard)
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Illustrative Sinus Rhythm</span>
          </div>

          <div className="relative bg-[#fffaf9]">
            <canvas ref={canvasRef} className="w-full block" />
          </div>

          <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-center text-xs text-slate-500">
            Live patient streaming begins immediately upon connecting your wireless ECG sensor.
          </div>
        </div>

        {/* 3-Step Clear User Workflow */}
        <div className="mt-20">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How Cardiac Digital Twin Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              A streamlined three-step workflow from signal acquisition to digital twin evaluation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base">Pair Compatible ECG Sensor</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect via standard Web Bluetooth directly in Google Chrome or Edge. Stream continuous single-lead biopotential signals securely without third-party drivers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base">Continuous Rhythm Monitoring</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Inspect electrophysiological waveforms on high-precision medical grid paper rendered at smooth 60 FPS, complete with gain controls and sweep speeds.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base">Heartbeat Classification</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Evaluate heartbeat morphology using machine-learning algorithms to categorize Normal, Supraventricular, Ventricular, and Paced beat types with full probability breakdowns.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 p-8 sm:p-10 rounded-3xl bg-slate-900 text-white space-y-6">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Purpose-built for cardiovascular researchers & technologists
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Calibrated Grid Paper</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                25 mm/s sweep speeds and 10 mm/mV voltage scaling matching clinical diagnostic paper standards.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Cpu className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Pattern Classification</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Machine-learning inference categorizing heartbeat complexes into standard AAMI rhythm classes.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <BarChart2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Session Results History</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Inspect posterior voting probability distributions and review recently analyzed complexes in one view.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Grounded AI Assistant</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Built-in conversational assistant providing answers on ECG parameters, feature windows, and data interpretations.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2 text-xs text-slate-500">
          <p>© 2026 Cardiac Digital Twin. Investigational Platform for Cardiovascular Research.</p>
          <p className="text-[11px] text-slate-400">
            Intended exclusively for research and algorithm evaluation. Not certified for direct clinical diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
};
