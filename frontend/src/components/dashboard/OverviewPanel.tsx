import React, { useEffect, useState } from 'react';
import { Activity, ArrowRight, Bluetooth, Bot, CheckCircle2, Cpu, Database, Heart, RefreshCw, Server, Sparkles, Users, XCircle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { DashboardTab } from '../common/Header';

interface OverviewPanelProps {
  onNavigate: (tab: DashboardTab) => void;
  onOpenChat?: () => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ onNavigate, onOpenChat }) => {
  const [apiHealth, setApiHealth] = useState<{ status: string; service: string } | null>(null);
  const [dbHealth, setDbHealth] = useState<{ status: string; database?: string; user?: string; error?: string } | null>(null);
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [observationCount, setObservationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // 1. API Health
      try {
        const h = await apiClient.getHealth();
        setApiHealth(h);
      } catch {
        setApiHealth({ status: 'unhealthy', service: 'offline' });
      }

      // 2. Database Health
      try {
        const db = await apiClient.getDatabaseHealth();
        setDbHealth({ status: db.status, database: db.database, user: db.user });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database offline';
        setDbHealth({ status: 'disconnected', error: msg });
      }

      // 3. Patients Count
      try {
        const patients = await apiClient.listPatients(0, 100);
        setPatientCount(patients.length);
      } catch {
        setPatientCount(null);
      }

      // 4. Observations Count
      try {
        const obs = await apiClient.listECGObservations(undefined, 0, 100);
        setObservationCount(obs.length);
      } catch {
        setObservationCount(null);
      }

      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Research Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time status of backend microservices, database connectivity, and digital twin state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg shadow-2xs transition-all"
            >
              <Bot className="w-3.5 h-3.5 text-sky-600" />
              <span>Ask AI Assistant</span>
            </button>
          )}

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : 'text-slate-400'}`} />
            <span>Refresh Telemetry</span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({lastChecked.toLocaleTimeString()})
            </span>
          </button>
        </div>
      </div>

      {/* Microservice Health Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="tour-health-cards">
        {/* Backend API */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FastAPI Service</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiHealth?.status === 'healthy' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-base font-bold text-slate-900">Online & Ready</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span className="text-base font-bold text-slate-900">Offline</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono">Endpoint: /health</p>
        </div>

        {/* Database Health */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PostgreSQL Database</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dbHealth?.status === 'connected' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-base font-bold text-slate-900">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-base font-bold text-slate-900">Not Connected</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono truncate">
            {dbHealth?.database ? `DB: ${dbHealth.database}` : 'Check backend/.env'}
          </p>
        </div>

        {/* Patients Registered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Research Patients</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {patientCount !== null ? patientCount : '—'}
            </span>
            <span className="text-xs text-slate-500">records in registry</span>
          </div>
          <button
            onClick={() => onNavigate('patients')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <span>View registry</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* ECG Observations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ECG Observations</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {observationCount !== null ? observationCount : '—'}
            </span>
            <span className="text-xs text-slate-500">logged sessions</span>
          </div>
          <button
            onClick={() => onNavigate('patients')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <span>View observations</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Digital Twin State & Fast Launch Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital Twin Electrophysiological Concept Representation */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cardiac Digital Twin State Engine</h3>
                <p className="text-xs text-slate-500">Electrophysiological in silico state representation</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              Model Synchronized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Waveform Input</span>
              <p className="font-bold text-slate-900 text-sm">Lead MLII (360 Hz)</p>
              <p className="text-slate-500 text-[11px]">MIT-BIH calibrated baseline</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Classifier Core</span>
              <p className="font-bold text-slate-900 text-sm">Random Forest (300 Trees)</p>
              <p className="text-slate-500 text-[11px]">234 temporal heartbeat features</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold">Digital Twin Output</span>
              <p className="font-bold text-slate-900 text-sm">AAMI Beat Topology</p>
              <p className="text-slate-500 text-[11px]">Classes: N, S, V, Q</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200/70 text-xs text-sky-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Digital Twin Physiological Principle:</span>
            </div>
            <p className="leading-relaxed text-sky-800/90">
              The Cardiac Digital Twin represents an in silico electrophysiological model reflecting cardiac rhythm dynamics. 
              By feeding continuous or windowed ECG observations into our machine-learning pipeline, the twin mirrors cardiac 
              depolarization morphology and tracks ectopic beat anomalies over time without invasive instrumentation.
            </p>
          </div>
        </div>

        {/* Quick Launch Cards */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">Platform Navigation</h3>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigate('prediction')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs group-hover:text-sky-700">ML Prediction Studio</h4>
                  <p className="text-[11px] text-slate-500">Test 234-feature heartbeats</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => onNavigate('monitor')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs group-hover:text-sky-700">ECG Live Monitor</h4>
                  <p className="text-[11px] text-slate-500">60 FPS medical waveform canvas</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => onNavigate('hardware')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Bluetooth className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs group-hover:text-sky-700">ECG Sensor Hardware</h4>
                  <p className="text-[11px] text-slate-500">Pair compatible Bluetooth device</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
            </button>

            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/60 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sky-900 text-xs group-hover:text-sky-700">Cardiac Assistant</h4>
                    <p className="text-[11px] text-sky-700/80">Explore features, AAMI beats & math</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
