import React from 'react';
import { BarChart2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { HeartbeatPredictionResponse } from '../../types/api';
import { AppTab } from '../common/Header';

interface ResultsViewProps {
  results: Array<{
    timestamp: Date;
    response: HeartbeatPredictionResponse;
    label: string;
  }>;
  onNavigate: (tab: AppTab) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, onNavigate }) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analysis Results & History</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review classified heartbeat complexes recorded during your current active session.
          </p>
        </div>

        {results.length > 0 && (
          <button
            onClick={() => onNavigate('analysis')}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Run New Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">No Analysis Records Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              You haven't run any heartbeat classifications in this session. Go to the Analysis screen to evaluate authentic ECG complexes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('analysis')}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs inline-flex items-center gap-2"
          >
            <span>Open Analysis Screen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            {results.map((item, idx) => {
              const res = item.response;
              return (
                <div key={idx} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xl font-black w-10 h-10 rounded-xl flex items-center justify-center border ${
                          res.predicted_class === 'N'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : res.predicted_class === 'S'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : res.predicted_class === 'V'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                        }`}
                      >
                        {res.predicted_class}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {res.predicted_class === 'N' && 'Class N: Normal Sinus Beat'}
                          {res.predicted_class === 'S' && 'Class S: Supraventricular Ectopic Beat'}
                          {res.predicted_class === 'V' && 'Class V: Ventricular Ectopic Beat (PVC)'}
                          {res.predicted_class === 'Q' && 'Class Q: Unclassifiable / Paced Morphology'}
                        </h4>
                        <p className="text-xs text-slate-500">{item.label}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Probabilities preview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {Object.entries(res.class_probabilities).map(([cls, prob]) => (
                      <div key={cls} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-500 font-semibold">Class {cls}:</span>
                          <span className="font-bold text-slate-900">{Math.round((prob ?? 0) * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px] text-amber-800/90">
              Note: Results are currently preserved in your browser memory for the duration of this active session. Model outputs represent algorithmic pattern recognition and are not medical diagnoses.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
