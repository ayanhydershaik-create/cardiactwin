import React from 'react';
import { FileCheck2, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Professional Investigational Software Notice */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
              Investigational Platform & Research Notice:
            </span>
            <p className="text-slate-600 leading-relaxed">
              This software platform is engineered for investigational, scientific, and educational research into in silico cardiac 
              digital twin modeling, automated Pan-Tompkins QRS detection, and machine-learning heartbeat classification. 
              The embedded ensemble algorithms (Random Forest on the MIT-BIH Arrhythmia Dataset) have not been cleared by the FDA, EMA, 
              or relevant regulatory authorities for primary clinical triage, diagnostic decision-making, patient monitoring, 
              or treatment prescription.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            <span className="font-medium text-slate-700">Cardiac Digital Twin Platform</span>
            <span className="text-slate-300">|</span>
            <span>MIT-BIH Standard Arrhythmia Baseline</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400">
            <span>FastAPI Architecture</span>
            <span>•</span>
            <span>Scikit-Learn Inference</span>
            <span>•</span>
            <span>PostgreSQL Engine</span>
            <span>•</span>
            <span>Web Bluetooth Telemetry</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
