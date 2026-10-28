import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Sliders 
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { bleAdapter, DEFAULT_BLE_CONFIG } from '../../services/ble/adapter';
import { BleConfiguration } from '../../types/ble';
import { useAuth } from '../../services/auth/authContext';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();

  // Diagnostics states
  const [apiHealth, setApiHealth] = useState<{ status: string; service: string } | null>(null);
  const [dbHealth, setDbHealth] = useState<{ status: string; database?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setLastChecked] = useState<Date>(new Date());

  // Hardware GATT settings
  const [bleConfig, setBleConfig] = useState<BleConfiguration>(bleAdapter.getConfig());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      try {
        const h = await apiClient.getHealth();
        setApiHealth(h);
      } catch {
        setApiHealth({ status: 'unhealthy', service: 'offline' });
      }

      try {
        const db = await apiClient.getDatabaseHealth();
        setDbHealth({ status: db.status, database: db.database });
      } catch (err: unknown) {
        setDbHealth({ status: 'disconnected', error: err instanceof Error ? err.message : 'Database offline' });
      }

      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleSaveGatt = (e: React.FormEvent) => {
    e.preventDefault();
    bleAdapter.updateConfig(bleConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & System Diagnostics</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your account profile, configure sensor parameters, and inspect backend microservice status.
        </p>
      </div>

      {/* 1. Account Profile */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
          Account Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-400 font-semibold block text-[11px]">Display Name</span>
            <span className="font-bold text-slate-900 text-sm mt-1 block">
              {user?.displayName || 'Cardiology Investigator'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-400 font-semibold block text-[11px]">Email Address</span>
            <span className="font-bold text-slate-900 text-sm mt-1 block">
              {user?.email || 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-400 font-semibold block text-[11px]">Account Type</span>
            <span className="font-bold text-sky-700 text-sm mt-1 block">
              {user?.isDemoUser ? 'Local Investigator (Demo)' : 'Google / Firebase Verified'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. System Diagnostics (Moved out of the main dashboard) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">System Diagnostics</h3>
            <p className="text-xs text-slate-500">Live health of backend endpoints and database connections.</p>
          </div>

          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh Diagnostics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* API Health */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FastAPI Backend</span>
              <Server className="w-4 h-4 text-sky-600" />
            </div>
            <div className="flex items-center gap-2">
              {apiHealth?.status === 'healthy' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">Online (127.0.0.1:8000)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">Service Offline</span>
                </>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400">Endpoint: GET /health</p>
          </div>

          {/* Database Health */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PostgreSQL Database</span>
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-center gap-2">
              {dbHealth?.status === 'connected' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">Connected ({dbHealth.database})</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">Not Connected</span>
                </>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              {dbHealth?.database ? `DB: ${dbHealth.database}` : 'Check backend/.env'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Advanced Hardware & GATT Parameters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Sensor GATT Configuration</h3>
          <p className="text-xs text-slate-500">Customize Bluetooth UUIDs for specialized ECG acquisition firmware.</p>
        </div>

        <form onSubmit={handleSaveGatt} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Primary Service UUID</label>
            <input
              type="text"
              value={bleConfig.serviceUuid}
              onChange={(e) => setBleConfig({ ...bleConfig, serviceUuid: e.target.value.trim() })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notify Characteristic UUID</label>
            <input
              type="text"
              value={bleConfig.characteristicUuid}
              onChange={(e) => setBleConfig({ ...bleConfig, characteristicUuid: e.target.value.trim() })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setBleConfig({ ...DEFAULT_BLE_CONFIG })}
              className="text-xs text-sky-600 hover:underline font-medium"
            >
              Restore Standard GATT Defaults
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{savedSuccess ? 'Settings Applied!' : 'Save Parameters'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
