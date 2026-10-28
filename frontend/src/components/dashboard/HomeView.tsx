import React from 'react';
import { 
  Bluetooth, 
  Cpu, 
  BarChart2, 
  Bot, 
  ArrowRight
} from 'lucide-react';
import { AppTab } from '../common/Header';
import { BleConnectionStatus } from '../../types/ble';
import { HeartbeatPredictionResponse } from '../../types/api';

interface HomeViewProps {
  onNavigate: (tab: AppTab) => void;
  bleStatus: BleConnectionStatus;
  sampleCount: number;
  recentResults: Array<{
    timestamp: Date;
    response: HeartbeatPredictionResponse;
    label: string;
  }>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  bleStatus,
  sampleCount,
  recentResults,
}) => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-400">
            Cardiac Digital Twin Platform
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome to your Cardiac Monitoring Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Acquire single-lead biopotentials from a compatible sensor, inspect calibrated waveforms, 
            and evaluate rhythm complexes with machine-learning classifiers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={() => onNavigate('monitor')}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <Bluetooth className="w-4 h-4" />
            <span>Connect Sensor</span>
          </button>
          <button
            onClick={() => onNavigate('analysis')}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>Run Analysis</span>
          </button>
        </div>
      </div>

      {/* Primary Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Sensor Status & Acquisition */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                ECG Sensor
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Bluetooth className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    bleStatus === 'connected' && sampleCount > 0
                      ? 'bg-emerald-500 animate-pulse'
                      : bleStatus === 'connected'
                      ? 'bg-amber-500'
                      : 'bg-slate-300'
                  }`}
                />
                <h3 className="font-bold text-slate-900 text-base">
                  {bleStatus === 'connected' && sampleCount > 0
                    ? 'Receiving Real-Time Data'
                    : bleStatus === 'connected'
                    ? 'Connected — Waiting for Samples'
                    : 'No Sensor Connected'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {bleStatus === 'connected' && sampleCount > 0
                  ? `${sampleCount.toLocaleString()} total biopotential samples recorded.`
                  : bleStatus === 'connected'
                  ? 'Sensor is paired over Web Bluetooth. Ensure lead electrodes are attached.'
                  : 'Pair your wireless ECG hardware to initiate continuous rhythm streaming.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('monitor')}
            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>{bleStatus === 'connected' ? 'View Live Monitor' : 'Pair Sensor'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Card 2: Beat Classification */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pattern Analysis
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Heartbeat Classification
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Evaluate single heartbeat windows against standard AAMI rhythm classes (Normal, Supraventricular, Ventricular, Paced).
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('analysis')}
            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>Open Prediction Studio</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Card 3: Session Results */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Analysis Log
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart2 className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  {recentResults.length}
                </span>
                <span className="text-xs text-slate-500">evaluations this session</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {recentResults.length > 0
                  ? `Latest classification: Class ${recentResults[0].response.predicted_class}`
                  : 'No heartbeats classified in this session yet.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('results')}
            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-between group"
          >
            <span>Review Results</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Assistant & Guidance Section */}
      <div className="p-6 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 text-sm">Have questions about your ECG or model results?</h4>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Our AI Assistant can explain AAMI rhythm classes (N, S, V, Q), R-peak segmentation windows, and troubleshooting steps.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('assistant')}
          className="px-4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-sky-700 font-semibold text-xs rounded-xl border border-sky-300 shadow-2xs transition-all shrink-0 self-start sm:self-auto"
        >
          Ask Assistant
        </button>
      </div>
    </div>
  );
};
