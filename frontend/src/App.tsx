import React, { useState } from 'react';
import { Brain } from 'lucide-react';
import { AuthProvider, useAuth } from './services/auth/authContext';
import { Header, AppTab } from './components/common/Header';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal, AuthMode } from './components/auth/AuthModal';
import { HomeView } from './components/dashboard/HomeView';
import { ECGMonitorView } from './components/dashboard/ECGMonitorView';
import { AnalysisView } from './components/dashboard/AnalysisView';
import { ResultsView } from './components/dashboard/ResultsView';
import { AssistantView } from './components/chat/AssistantView';
import { SettingsView } from './components/dashboard/SettingsView';
import { CardiacAgentChatbot } from './components/chat/CardiacAgentChatbot';
import { bleAdapter } from './services/ble/adapter';
import { BleConnectionStatus } from './types/ble';
import { HeartbeatPredictionResponse } from './types/api';

interface SessionResult {
  timestamp: Date;
  response: HeartbeatPredictionResponse;
  label: string;
}

const MainApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [bleStatus, setBleStatus] = useState<BleConnectionStatus>(bleAdapter.getStatus());
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [recentResults, setRecentResults] = useState<SessionResult[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);

  // Subscribe to BLE connection status
  React.useEffect(() => {
    const unsub = bleAdapter.onStatusChange((status) => {
      setBleStatus(status);
    });
    return () => unsub();
  }, []);

  const handleRecordResult = (response: HeartbeatPredictionResponse, label: string) => {
    setRecentResults((prev) => [
      {
        timestamp: new Date(),
        response,
        label,
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfd] text-slate-900 selection:bg-sky-100">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        bleStatus={bleStatus}
        sampleCount={sampleCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'home' && (
          <HomeView
            onNavigate={setCurrentTab}
            bleStatus={bleStatus}
            sampleCount={sampleCount}
            recentResults={recentResults}
          />
        )}

        {currentTab === 'monitor' && (
          <ECGMonitorView
            bleStatus={bleStatus}
            sampleCount={sampleCount}
            onSampleCountChange={setSampleCount}
          />
        )}

        {currentTab === 'analysis' && (
          <AnalysisView onRecordResult={handleRecordResult} />
        )}

        {currentTab === 'results' && (
          <ResultsView
            results={recentResults}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'assistant' && <AssistantView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      <footer className="border-t border-slate-200/80 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-1">
          <p>© 2026 Cardiac Digital Twin • Investigational Electrophysiology Platform</p>
          <p className="text-[11px] text-slate-400">
            For research and computational evaluation purposes only.
          </p>
        </div>
      </footer>

      {/* ── Floating Gemini Agent Button ── */}
      <button
        onClick={() => setAgentOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 shadow-xl flex items-center justify-center text-white hover:scale-110 transition-all duration-200 z-40 ${agentOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        title="Open Cardiac AI Agent (Gemini 2.0 Flash)"
      >
        <Brain className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
      </button>

      {/* ── Cardiac Agentic AI Chatbot ── */}
      <CardiacAgentChatbot
        isOpen={agentOpen}
        onClose={() => setAgentOpen(false)}
        onNavigateTab={(tab: string) => setCurrentTab(tab as AppTab)}
      />
    </div>
  );
};

const RootView: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-9 h-9 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Cardiac Digital Twin...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setAuthModalOpen(true);
          }}
          onExploreDemo={() => {
            setAuthMode('signin');
            setAuthModalOpen(true);
          }}
        />

        <AuthModal
          isOpen={authModalOpen}
          initialMode={authMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => setAuthModalOpen(false)}
        />
      </>
    );
  }

  return <MainApp />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RootView />
    </AuthProvider>
  );
};

export default App;
