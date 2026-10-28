import React from 'react';
import { BookOpen, Database, Layers, ShieldAlert } from 'lucide-react';

export const ResearchDocViewer: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Research & Architecture Documentation</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Technical specifications of the Cardiac Digital Twin machine-learning pipeline, datasets, and schema.
        </p>
      </div>

      {/* 1. Dataset & Acquisition */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <BookOpen className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-bold text-slate-900">1. MIT-BIH Arrhythmia Dataset & Segmentation</h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The research model is trained on curated records from the PhysioNet <strong>MIT-BIH Arrhythmia Database</strong> (Records 100, 101, 102, 103, 104, 105). 
          Each record contains two-channel ambulatory ECG recordings sampled at <strong>360 Hz</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800">Heartbeat Window Framing:</span>
            <ul className="list-disc list-inside text-slate-600 space-y-1 mt-1 text-[11px]">
              <li>Pre-peak duration: <strong>0.25 seconds</strong> (90 samples at 360 Hz)</li>
              <li>Post-peak duration: <strong>0.40 seconds</strong> (144 samples at 360 Hz)</li>
              <li>Total feature dimension: <strong>234 numerical values</strong> per heartbeat</li>
              <li>Lead configuration: Modified Limb Lead II (MLII)</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800">R-Peak Detector Validation:</span>
            <ul className="list-disc list-inside text-slate-600 space-y-1 mt-1 text-[11px]">
              <li>Filter: 3rd-order Butterworth bandpass (5 Hz – 20 Hz)</li>
              <li>Matching tolerance: <strong>150 ms</strong></li>
              <li>Peak Detection Sensitivity: <strong>100.0%</strong> (True Positives: 2,273)</li>
              <li>Precision: <strong>99.21%</strong> • F1-Score: <strong>99.61%</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Machine Learning Classifier */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">2. Random Forest Classification Baseline</h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Heartbeats are categorized according to the standard <strong>Association for the Advancement of Medical Instrumentation (AAMI)</strong> class taxonomy.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">AAMI Label</th>
                <th className="px-3.5 py-2.5">Category Name</th>
                <th className="px-3.5 py-2.5">MIT-BIH Beat Symbols</th>
                <th className="px-3.5 py-2.5">Electrophysiological Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3.5 py-2 font-mono font-bold text-emerald-700">N</td>
                <td className="px-3.5 py-2 font-semibold text-slate-800">Normal Beat</td>
                <td className="px-3.5 py-2 font-mono text-slate-600">N, L, R, e, j</td>
                <td className="px-3.5 py-2 text-slate-600 text-[11px]">Normal sinus beat or left/right bundle branch block.</td>
              </tr>
              <tr>
                <td className="px-3.5 py-2 font-mono font-bold text-amber-700">S</td>
                <td className="px-3.5 py-2 font-semibold text-slate-800">Supraventricular Ectopic</td>
                <td className="px-3.5 py-2 font-mono text-slate-600">A, a, J, S</td>
                <td className="px-3.5 py-2 text-slate-600 text-[11px]">Atrial premature, aberrated atrial, or nodal premature beat.</td>
              </tr>
              <tr>
                <td className="px-3.5 py-2 font-mono font-bold text-rose-700">V</td>
                <td className="px-3.5 py-2 font-semibold text-slate-800">Ventricular Ectopic</td>
                <td className="px-3.5 py-2 font-mono text-slate-600">V, E</td>
                <td className="px-3.5 py-2 text-slate-600 text-[11px]">Premature ventricular contraction (PVC) or ventricular escape.</td>
              </tr>
              <tr>
                <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">Q</td>
                <td className="px-3.5 py-2 font-semibold text-slate-800">Unclassifiable / Paced</td>
                <td className="px-3.5 py-2 font-mono text-slate-600">/, f, Q</td>
                <td className="px-3.5 py-2 text-slate-600 text-[11px]">Paced beat, fusion paced beat, or unclassifiable artifact.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className="font-bold text-slate-800">Model Architecture & Training Parameters:</span>
          <ul className="list-disc list-inside space-y-0.5 mt-1 text-[11px]">
            <li>Classifier: Scikit-learn <code className="font-mono text-sky-700">RandomForestClassifier(n_estimators=300, class_weight='balanced')</code></li>
            <li>Train / Test Partition: GroupShuffleSplit (25% holdout partitioned by record to avoid patient data leakage)</li>
            <li>Inference latency: &lt; 5 ms per heartbeat</li>
          </ul>
        </div>
      </div>

      {/* 3. Database Architecture */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Database className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-900">3. Backend PostgreSQL Relational Schema</h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The FastAPI backend communicates with a PostgreSQL database (<code className="font-mono text-sky-700">cardiac_twin</code>) managed via SQLAlchemy 2.1 ORM models:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800 font-sans">patients:</span>
            <p className="text-[11px] text-slate-600">id (PK), external_id (Unique), display_name, date_of_birth, created_at</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800 font-sans">ecg_observations:</span>
            <p className="text-[11px] text-slate-600">id (PK), patient_id (FK), source, record_name, sample_rate_hz, signal_data (JSON), sampled_at</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800 font-sans">ai_predictions (Planned):</span>
            <p className="text-[11px] text-slate-600">id, patient_id, observation_id, model_name, predicted_class, confidence, is_research_output</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-800 font-sans">digital_twin_states (Planned):</span>
            <p className="text-[11px] text-slate-600">id, patient_id, state_name, state_data (JSON), recorded_at</p>
          </div>
        </div>
      </div>

      {/* 4. Research Safety Disclaimer */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
            Important Research & Clinical Disclaimer:
          </span>
          <p className="leading-relaxed text-amber-800/90">
            This platform is an academic research software prototype. Machine-learning predictions and telemetry observations 
            must not be utilized as medical advice, clinical diagnoses, or therapeutic decision support. Rare cardiac arrhythmia 
            subtypes remain underrepresented in the baseline dataset. Always refer electrophysiological evaluations to qualified cardiologists.
          </p>
        </div>
      </div>
    </div>
  );
};
