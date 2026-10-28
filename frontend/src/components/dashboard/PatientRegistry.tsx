import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Calendar, Plus, RefreshCw, UserCheck, Users } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { ECGObservationRead, PatientRead } from '../../types/api';

export const PatientRegistry: React.FC = () => {
  const [patients, setPatients] = useState<PatientRead[]>([]);
  const [observations, setObservations] = useState<ECGObservationRead[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Patient Form Modal State
  const [showAddPatientModal, setShowAddPatientModal] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [externalId, setExternalId] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [isSubmittingPatient, setIsSubmittingPatient] = useState<boolean>(false);
  const [patientFormError, setPatientFormError] = useState<string | null>(null);

  // New Observation Form Modal State
  const [showAddObsModal, setShowAddObsModal] = useState<boolean>(false);
  const [obsPatientId, setObsPatientId] = useState<number>(1);
  const [obsSource, setObsSource] = useState<string>('MIT-BIH');
  const [obsRecordName, setObsRecordName] = useState<string>('100');
  const [obsSampleRate, setObsSampleRate] = useState<number>(360);
  const [isSubmittingObs, setIsSubmittingObs] = useState<boolean>(false);
  const [obsFormError, setObsFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pts, obs] = await Promise.all([
        apiClient.listPatients(0, 100).catch((err) => {
          throw new Error(`Failed to load patients: ${err.message}`);
        }),
        apiClient.listECGObservations(undefined, 0, 100).catch((err) => {
          throw new Error(`Failed to load observations: ${err.message}`);
        }),
      ]);

      setPatients(pts);
      setObservations(obs);
      if (pts.length > 0 && selectedPatientId === null) {
        setSelectedPatientId(pts[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setPatientFormError('Display name is required.');
      return;
    }

    setIsSubmittingPatient(true);
    setPatientFormError(null);

    try {
      const newPt = await apiClient.createPatient({
        display_name: displayName.trim(),
        external_id: externalId.trim() || undefined,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
      });

      setPatients((prev) => [...prev, newPt]);
      setSelectedPatientId(newPt.id);
      setShowAddPatientModal(false);
      setDisplayName('');
      setExternalId('');
      setDateOfBirth('');
    } catch (err: unknown) {
      setPatientFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingPatient(false);
    }
  };

  const handleCreateObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingObs(true);
    setObsFormError(null);

    try {
      const newObs = await apiClient.createECGObservation({
        patient_id: obsPatientId,
        source: obsSource.trim() || 'MIT-BIH',
        record_name: obsRecordName.trim() || undefined,
        sample_rate_hz: Number(obsSampleRate) || 360,
        sampled_at: new Date().toISOString(),
      });

      setObservations((prev) => [newObs, ...prev]);
      setShowAddObsModal(false);
    } catch (err: unknown) {
      setObsFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmittingObs(false);
    }
  };

  const filteredObservations = selectedPatientId
    ? observations.filter((o) => o.patient_id === selectedPatientId)
    : observations;

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Research Patients & Observations</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registered subjects and historical telemetry observations retrieved from PostgreSQL backend tables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddPatientModal(true)}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Patient</span>
          </button>

          {patients.length > 0 && (
            <button
              onClick={() => {
                setObsPatientId(selectedPatientId || patients[0].id);
                setShowAddObsModal(true);
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4 text-sky-600" />
              <span>Record Observation</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Database Notice:</span>
            <p className="mt-0.5 leading-relaxed">{error}</p>
            <p className="text-[11px] text-amber-700 mt-1">
              Ensure PostgreSQL is running and <code className="font-mono">DATABASE_URL</code> is properly configured in <code className="font-mono">backend/.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* Two-Column Layout: Patient List on Left, Observations on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Patient List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-sm">Patients ({patients.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /patients</span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            {loading && patients.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading patient records...</div>
            ) : patients.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">No patients recorded in database.</p>
                <button
                  onClick={() => setShowAddPatientModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 rounded-lg"
                >
                  Create First Record
                </button>
              </div>
            ) : (
              patients.map((p) => {
                const isSelected = selectedPatientId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full p-4 text-left transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{p.display_name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-mono">ID: {p.id}</span>
                        {p.external_id && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ext: {p.external_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {p.date_of_birth && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.date_of_birth).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: ECG Observations for Selected Patient */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                ECG Observations {selectedPatientId ? `(Patient #${selectedPatientId})` : ''}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /ecg-observations</span>
          </div>

          <div className="overflow-x-auto">
            {loading && observations.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading observations...</div>
            ) : filteredObservations.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">
                  {selectedPatientId
                    ? `No ECG observations recorded for Patient #${selectedPatientId}.`
                    : 'No observations found.'}
                </p>
                {selectedPatientId && (
                  <button
                    onClick={() => {
                      setObsPatientId(selectedPatientId);
                      setShowAddObsModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 rounded-lg"
                  >
                    Log New Observation
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Obs ID</th>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Source / Record</th>
                    <th className="px-4 py-3">Sample Rate</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredObservations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">#{obs.id}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{obs.patient_id}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{obs.source}</span>
                        {obs.record_name && (
                          <span className="ml-1 text-[11px] text-slate-500 font-mono">
                            (Rec {obs.record_name})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {obs.sample_rate_hz ? `${obs.sample_rate_hz} Hz` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {obs.created_at ? new Date(obs.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Patient */}
      {showAddPatientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Register New Research Patient</h3>
            <p className="text-xs text-slate-500">
              Creates a new record in the backend PostgreSQL <code className="font-mono">patients</code> table.
            </p>

            {patientFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {patientFormError}
              </div>
            )}

            <form onSubmit={handleCreatePatient} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="e.g. Research Subject A102"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  External ID (Optional, must be unique)
                </label>
                <input
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="e.g. SUBJ-2026-001"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPatientModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPatient}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  {isSubmittingPatient ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add ECG Observation */}
      {showAddObsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record New ECG Observation</h3>
            <p className="text-xs text-slate-500">
              Dispatches payload to <code className="font-mono">POST /ecg-observations</code>.
            </p>

            {obsFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {obsFormError}
              </div>
            )}

            <form onSubmit={handleCreateObservation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Patient ID *
                </label>
                <select
                  value={obsPatientId}
                  onChange={(e) => setObsPatientId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} - {p.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Source Protocol / Hardware
                </label>
                <input
                  type="text"
                  value={obsSource}
                  onChange={(e) => setObsSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="e.g. MIT-BIH or Wireless-Sensor-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Record / Channel Name
                  </label>
                  <input
                    type="text"
                    value={obsRecordName}
                    onChange={(e) => setObsRecordName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    placeholder="100 or Lead-II"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sample Rate (Hz)
                  </label>
                  <input
                    type="number"
                    value={obsSampleRate}
                    onChange={(e) => setObsSampleRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    placeholder="360"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddObsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingObs}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  {isSubmittingObs ? 'Recording...' : 'Save Observation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
