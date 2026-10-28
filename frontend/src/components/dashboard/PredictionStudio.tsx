import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Cpu, HelpCircle, Play, RotateCcw, Sparkles } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { HeartbeatPredictionResponse } from '../../types/api';
import { PRESET_HEARTBEATS, PresetHeartbeat } from '../../data/presetSamples';

export const PredictionStudio: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<PresetHeartbeat>(PRESET_HEARTBEATS[0]);
  const [rawText, setRawText] = useState<string>('');
  const [features, setFeatures] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<HeartbeatPredictionResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize with selected preset
  const loadPreset = (preset: PresetHeartbeat) => {
    setSelectedPreset(preset);
    const jsonStr = JSON.stringify(preset.features, null, 2);
    setRawText(jsonStr);
    setFeatures(preset.features);
    setValidationError(null);
    setPrediction(null);
    setApiError(null);
  };

  useEffect(() => {
    loadPreset(PRESET_HEARTBEATS[0]);
  }, []);

  // Parse text changes
  const handleTextChange = (text: string) => {
    setRawText(text);
    setPrediction(null);
    setApiError(null);

    try {
      let parsed: unknown;
      // Accept either comma-separated or JSON array
      const trimmed = text.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        parsed = JSON.parse(trimmed);
      } else {
        parsed = trimmed.split(/[\s,]+/).map((v) => Number(v));
      }

      if (!Array.isArray(parsed)) {
        setValidationError('Input must evaluate to an array of numbers.');
        setFeatures([]);
        return;
      }

      const nums = parsed as number[];
      if (nums.length !== 234) {
        setValidationError(`Array contains ${nums.length} values. Exactly 234 numerical features are required.`);
        setFeatures(nums);
        return;
      }

      const invalidIdx = nums.findIndex((n) => typeof n !== 'number' || !Number.isFinite(n));
      if (invalidIdx !== -1) {
        setValidationError(`Item at index ${invalidIdx} is not a valid finite number.`);
        setFeatures([]);
        return;
      }

      setFeatures(nums);
      setValidationError(null);
    } catch (err: unknown) {
      setValidationError(`Syntax error parsing values: ${err instanceof Error ? err.message : String(err)}`);
      setFeatures([]);
    }
  };

  // Draw Heartbeat Segment Canvas (234 samples)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || features.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw baseline grid
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.12)';
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Min and max for scaling
    let minV = Math.min(...features);
    let maxV = Math.max(...features);
    if (Math.abs(maxV - minV) < 0.001) {
      minV -= 0.5;
      maxV += 0.5;
    }
    const range = maxV - minV;

    // Draw R-peak reference line (sample 90 is the 0.25s R-peak mark)
    const peakX = (90 / features.length) * w;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
    ctx.beginPath();
    ctx.moveTo(peakX, 0);
    ctx.lineTo(peakX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waveform trace
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#0284c7';
    ctx.beginPath();

    features.forEach((val, idx) => {
      const x = (idx / (features.length - 1)) * w;
      const normalized = (val - minV) / range;
      const y = h - (normalized * (h * 0.75) + h * 0.125);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [features]);

  // Execute inference on existing FastAPI backend
  const handlePredict = async () => {
    if (features.length !== 234 || validationError) {
      return;
    }

    setLoading(true);
    setApiError(null);
    setPrediction(null);

    try {
      const res = await apiClient.predictHeartbeat(features);
      setPrediction(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const aamiMeanings: Record<string, { title: string; desc: string; badgeColor: string }> = {
    N: {
      title: 'Normal / Bundle Branch Block (N)',
      desc: 'Typical supraventricular conduction sequence without ectopic excitation.',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    },
    S: {
      title: 'Supraventricular Ectopic Beat (SVEB) (S)',
      desc: 'Premature beat originating in the atria or AV junction.',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-300',
    },
    V: {
      title: 'Ventricular Ectopic Beat (VEB) (V)',
      desc: 'Premature ventricular contraction (PVC) originating directly in the ventricles.',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-300',
    },
    Q: {
      title: 'Unclassifiable / Paced Beat (Q)',
      desc: 'Paced beat or artifact heartbeat morphology.',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-300',
    },
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Machine-Learning Heartbeat Classification</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Direct inference using the trained Random Forest model (300 estimators) via the backend endpoint{' '}
          <code className="text-sky-700 font-mono font-semibold">POST /predict/heartbeat</code>.
        </p>
      </div>

      {/* Preset Selector Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Verified MIT-BIH Research Presets
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">1-click test heartbeats</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_HEARTBEATS.map((preset) => {
            const isSelected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                      preset.label === 'N'
                        ? 'bg-emerald-100 text-emerald-800'
                        : preset.label === 'S'
                        ? 'bg-amber-100 text-amber-800'
                        : preset.label === 'V'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    Class {preset.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                </div>
                <h4 className="font-bold text-xs text-slate-800">{preset.name}</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Input & Preview on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Feature Vector Input & Visualizer */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Heartbeat Window (234 Values)</h3>
                <p className="text-[11px] text-slate-500">
                  Window: -0.25s (90 samples) to +0.40s (144 samples) @ 360 Hz
                </p>
              </div>
              <button
                onClick={() => loadPreset(selectedPreset)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Reset to preset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Waveform Canvas of the 234 samples */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-ecg-grid">
              <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>R-Peak Centered (t = 0.25s)</span>
                <span>{features.length} / 234 samples</span>
              </div>
              <canvas
                ref={canvasRef}
                width={500}
                height={160}
                className="w-full block"
              />
            </div>

            {/* Raw JSON / Numeric Array Editor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Features Vector (JSON Array of 234 floats):
              </label>
              <textarea
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={6}
                className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none focus:bg-white transition-all text-slate-800"
                placeholder="[0.12, 0.15, ... 234 values]"
              />
            </div>

            {/* Validation Notice / Error */}
            {validationError ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Input valid: Exactly 234 numerical features ready for backend evaluation.</span>
              </div>
            )}

            {/* Submit Prediction Button */}
            <button
              onClick={handlePredict}
              disabled={loading || features.length !== 234 || Boolean(validationError)}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Evaluating Model in FastAPI...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Classify Heartbeat (POST /predict/heartbeat)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Prediction Results */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">Inference Output</h3>
              </div>
              {prediction && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Status: 200 OK
                </span>
              )}
            </div>

            {/* API Error Notification */}
            {apiError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Inference Error</span>
                </div>
                <p className="leading-relaxed">{apiError}</p>
              </div>
            )}

            {/* Initial empty state */}
            {!prediction && !apiError && !loading && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-700 text-sm">No Classification Executed Yet</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Select a research preset on the left and click <strong>Classify Heartbeat</strong> to invoke the machine-learning pipeline.
                </p>
              </div>
            )}

            {/* Actual Result Display */}
            {prediction && (
              <div className="space-y-5">
                {/* Predicted Class Card */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      Predicted Beat Class
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {prediction.model_type}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span
                      className={`text-4xl font-black px-3 py-1 rounded-xl border ${
                        prediction.predicted_class === 'N'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : prediction.predicted_class === 'S'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : prediction.predicted_class === 'V'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                      }`}
                    >
                      {prediction.predicted_class}
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">
                        {aamiMeanings[prediction.predicted_class]?.title || `Class ${prediction.predicted_class}`}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {aamiMeanings[prediction.predicted_class]?.desc || 'AAMI Heartbeat Category'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Class Probabilities Distribution */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Posterior Class Probabilities (Random Forest Voting)
                  </h4>

                  <div className="space-y-2">
                    {Object.entries(prediction.class_probabilities).map(([cls, prob]) => {
                      const percentage = Math.round((prob ?? 0) * 100);
                      const isWinner = cls === prediction.predicted_class;
                      return (
                        <div key={cls} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-mono font-bold ${isWinner ? 'text-sky-700' : 'text-slate-600'}`}>
                              Class {cls} {aamiMeanings[cls] ? `(${aamiMeanings[cls].title.split(' ')[0]})` : ''}
                            </span>
                            <span className="font-mono text-slate-700 font-semibold">
                              {(prob ?? 0).toFixed(4)} ({percentage}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isWinner
                                  ? cls === 'N'
                                    ? 'bg-emerald-500'
                                    : cls === 'S'
                                    ? 'bg-amber-500'
                                    : cls === 'V'
                                    ? 'bg-rose-500'
                                    : 'bg-indigo-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Non-Clinical Research Stamp */}
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-800">
                      Non-Diagnostic Classification Result:
                    </span>
                    <p className="text-amber-800/90 leading-relaxed text-[11px]">
                      Returned payload flags <code className="font-mono">clinical_use: {String(prediction.clinical_use)}</code>. 
                      This is an automated statistical output intended strictly for research analysis and machine-learning benchmarking.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
