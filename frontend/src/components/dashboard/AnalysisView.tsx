import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Play, RotateCcw, AlertCircle, Check, Sparkles, Activity } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { bleAdapter } from '../../services/ble/adapter';
import { HeartbeatPredictionResponse } from '../../types/api';
import { PRESET_HEARTBEATS, PresetHeartbeat } from '../../data/presetSamples';

interface AnalysisViewProps {
  onRecordResult: (prediction: HeartbeatPredictionResponse, label: string) => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ onRecordResult }) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetHeartbeat | null>(null);
  const [isLiveSource, setIsLiveSource] = useState<boolean>(true);
  const [rawText, setRawText] = useState<string>('');
  const [features, setFeatures] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<HeartbeatPredictionResponse | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadLiveSample = () => {
    setIsLiveSource(true);
    setSelectedPreset(null);
    const liveVoltages = bleAdapter.getRecentVoltages(234);
    let sample: number[] = [];

    if (liveVoltages.length >= 234) {
      sample = liveVoltages.slice(-234);
    } else if (liveVoltages.length > 0) {
      for (let i = 0; i < 234; i++) {
        const idx = Math.min(liveVoltages.length - 1, Math.floor((i / 234) * liveVoltages.length));
        sample.push(liveVoltages[idx] || 0.0);
      }
    } else {
      sample = PRESET_HEARTBEATS[0].features;
    }

    setRawText(JSON.stringify(sample, null, 2));
    setFeatures(sample);
    setValidationError(null);
    setApiError(null);
  };

  const loadPreset = (preset: PresetHeartbeat) => {
    setIsLiveSource(false);
    setSelectedPreset(preset);
    setRawText(JSON.stringify(preset.features, null, 2));
    setFeatures(preset.features);
    setValidationError(null);
    setApiError(null);
  };

  useEffect(() => {
    // Default to Live Hardware Telemetry window if connected/available
    loadLiveSample();
  }, []);

  const handleTextChange = (text: string) => {
    setRawText(text);
    setApiError(null);

    try {
      let parsed: unknown;
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
        setValidationError(`Item at index ${invalidIdx} is non-finite.`);
        setFeatures([]);
        return;
      }

      setFeatures(nums);
      setValidationError(null);
    } catch (err: unknown) {
      setValidationError(`Syntax error: ${err instanceof Error ? err.message : String(err)}`);
      setFeatures([]);
    }
  };

  // Render 234-sample complex
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || features.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.1)';
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

    let minV = Math.min(...features);
    let maxV = Math.max(...features);
    if (Math.abs(maxV - minV) < 0.001) {
      minV -= 0.5;
      maxV += 0.5;
    }
    const range = maxV - minV;

    // R-peak line at sample 90 (0.25s mark)
    const peakX = (90 / features.length) * w;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.4)';
    ctx.beginPath();
    ctx.moveTo(peakX, 0);
    ctx.lineTo(peakX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waveform
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

  const handlePredict = async () => {
    if (features.length !== 234 || validationError) return;

    setLoading(true);
    setApiError(null);

    try {
      const res = await apiClient.predictHeartbeat(features);
      setLatestPrediction(res);
      const label = isLiveSource
        ? `Live Hardware Stream (${res.predicted_class})`
        : (selectedPreset ? selectedPreset.name : 'Custom ECG Window');
      onRecordResult(res, label);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Heartbeat Analysis & Classification</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Evaluate isolated 234-sample heartbeat windows against the pattern-recognition classification model.
        </p>
      </div>

      {/* Source Selector: Live Hardware Window vs Clinical Reference Presets */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Input Signal Source
            </h3>
          </div>
          
          <button
            onClick={loadLiveSample}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              isLiveSource
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Load Live Sensor Telemetry (234 Samples)</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-xs font-bold text-slate-600">Reference Benchmark Cohorts</span>
            </div>
            <span className="text-[11px] text-slate-400">Authentic MIT-BIH Arrhythmia Presets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESET_HEARTBEATS.map((preset) => {
              const isSelected = !isLiveSource && selectedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
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
                  <h4 className="font-bold text-xs text-slate-900">{preset.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Input & Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Waveform preview & JSON */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Heartbeat Window (234 Samples)</h3>
            <button
              onClick={() => {
                if (isLiveSource || !selectedPreset) {
                  loadLiveSample();
                } else {
                  loadPreset(selectedPreset);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-[#fffaf9]">
            <canvas ref={canvasRef} width={500} height={140} className="w-full block" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sample Vector (JSON Array of 234 floats):
            </label>
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={5}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {validationError ? (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Vector valid: Exactly 234 numerical values ready for analysis.</span>
            </div>
          )}

          <button
            onClick={handlePredict}
            disabled={loading || features.length !== 234 || Boolean(validationError)}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Execute Heartbeat Classification</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Output */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
            Analysis Output
          </h3>

          {apiError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Backend Error</span>
              </div>
              <p>{apiError}</p>
            </div>
          )}

          {!latestPrediction && !apiError && (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Cpu className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs text-slate-500">
                Select a sample and click <strong>Execute Heartbeat Classification</strong> to view results.
              </p>
            </div>
          )}

          {latestPrediction && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  Predicted Classification
                </span>
                <div className="flex items-baseline gap-3">
                  <span
                    className={`text-4xl font-black px-3 py-1 rounded-xl border ${
                      latestPrediction.predicted_class === 'N'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : latestPrediction.predicted_class === 'S'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : latestPrediction.predicted_class === 'V'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    }`}
                  >
                    {latestPrediction.predicted_class}
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {latestPrediction.predicted_class === 'N' && 'Normal Sinus Complex'}
                      {latestPrediction.predicted_class === 'S' && 'Supraventricular Ectopic Beat (SVEB)'}
                      {latestPrediction.predicted_class === 'V' && 'Premature Ventricular Contraction (VEB)'}
                      {latestPrediction.predicted_class === 'Q' && 'Unclassifiable / Paced Morphology'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AAMI Classification Taxonomy
                    </p>
                  </div>
                </div>
              </div>

              {/* Probabilities */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Model Probability Voting
                </h4>
                {Object.entries(latestPrediction.class_probabilities).map(([cls, prob]) => {
                  const pct = Math.round((prob ?? 0) * 100);
                  const isWinner = cls === latestPrediction.predicted_class;
                  return (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`font-mono ${isWinner ? 'font-bold text-sky-700' : 'text-slate-600'}`}>
                          Class {cls}
                        </span>
                        <span className="font-mono text-slate-700 font-semibold">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isWinner ? 'bg-sky-600' : 'bg-slate-300'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
