import React, { useEffect, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Check, Heart, Sparkles, X } from 'lucide-react';
import { DashboardTab } from '../common/Header';

interface TourStep {
  title: string;
  tab: DashboardTab;
  highlightId?: string;
  message: string;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Cardiac Digital Twin!',
    tab: 'overview',
    message: 'Hello! I am Pulse, your digital twin research guide. I will walk you through the key capabilities of our biomedical platform.',
    tip: 'You can replay this tour anytime using the help icon in the top header.',
  },
  {
    title: 'Microservices & Health Checks',
    tab: 'overview',
    highlightId: 'tour-health-cards',
    message: 'These telemetry cards monitor the real-time health of your FastAPI service (/health) and PostgreSQL database connection.',
    tip: 'Click Refresh Status to query the live backend endpoints at any moment.',
  },
  {
    title: 'Real-Time ECG Monitor',
    tab: 'monitor',
    message: 'This screen renders single-lead ECG biopotential signals on a standard 25 mm/s, 10 mm/mV medical paper grid at 60 FPS.',
    tip: 'Toggle between Simulated Demo Mode and Live Hardware BLE to test signal visualization.',
  },
  {
    title: '234-Feature ML Prediction Studio',
    tab: 'prediction',
    message: 'Here you can evaluate heartbeats against our trained Random Forest model. It requires exactly 234 preprocessed temporal samples.',
    tip: 'Use our 1-click MIT-BIH presets to test Normal, SVEB, VEB, and Paced beat classifications.',
  },
  {
    title: 'Patients & Observations Registry',
    tab: 'patients',
    message: 'Manage research subjects and track ECG observation sessions persisted in your backend PostgreSQL tables.',
    tip: 'You can register new patients and record observation timestamps directly through the API.',
  },
  {
    title: 'Compatible Sensor Hardware & Telemetry',
    tab: 'hardware',
    message: 'Pair physical wireless ECG devices via the Web Bluetooth API to stream real-time biopotential voltage packets.',
    tip: 'Advanced GATT parameters and microcontroller pinouts are accessible in the Advanced Config drawer.',
  },
];

interface MascotGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: DashboardTab) => void;
}

export const MascotGuide: React.FC<MascotGuideProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      const step = TOUR_STEPS[currentStep];
      if (step) {
        onNavigateTab(step.tab);
      }
    }
  }, [isOpen, currentStep, onNavigateTab]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem('cardiac_twin_tour_completed', 'true');
    } catch {
      // storage unavailable
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end p-4 sm:p-6 lg:p-8">
      {/* Semi-transparent backdrop for focus */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] pointer-events-auto transition-opacity"
        onClick={handleFinish}
      />

      {/* Mascot & Floating Speech Card Container */}
      <div className="relative z-50 max-w-lg w-full mx-auto pointer-events-auto">
        <div className="bg-white rounded-3xl p-6 shadow-2xl border border-sky-100 ring-1 ring-slate-900/5 space-y-4">
          {/* Header & Close */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            {/* Mascot Avatar */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 animate-mascot">
                  <Heart className="w-6 h-6 fill-white" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                  <Activity className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-slate-900 text-sm">Pulse</h4>
                  <span className="text-[10px] font-semibold px-2 py-0.2 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                    Research Mascot
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Step {currentStep + 1} of {TOUR_STEPS.length}</p>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              title="Close tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Speech Message */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 text-base">{step.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{step.message}</p>
            {step.tip && (
              <div className="p-2.5 rounded-xl bg-sky-50/80 border border-sky-100 text-[11px] text-sky-800 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span><strong>Tip: </strong>{step.tip}</span>
              </div>
            )}
          </div>

          {/* Progress dots & Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {/* Step Indicators */}
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStep
                      ? 'w-6 bg-sky-600'
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                onClick={handleNext}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                {isLast ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Get Started</span>
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
