import React, { useState } from 'react';
import { 
  Activity, 
  Bluetooth, 
  Cpu, 
  BarChart2, 
  Bot, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User 
} from 'lucide-react';
import { useAuth } from '../../services/auth/authContext';
import { BleConnectionStatus } from '../../types/ble';

export type AppTab = 
  | 'home' 
  | 'monitor' 
  | 'analysis' 
  | 'results' 
  | 'assistant' 
  | 'settings';

export type DashboardTab = AppTab | 'overview' | 'prediction' | 'patients' | 'hardware' | 'docs';

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  bleStatus: BleConnectionStatus;
  sampleCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  bleStatus,
  sampleCount,
}) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: 'Home', icon: Activity },
    { id: 'monitor', label: 'ECG Monitor', icon: Bluetooth },
    { id: 'analysis', label: 'Analysis', icon: Cpu },
    { id: 'results', label: 'Results', icon: BarChart2 },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('home')}
              className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">
                Cardiac Digital Twin
              </span>
            </button>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Status Indicator & Account */}
          <div className="flex items-center gap-3">
            {/* Live Sensor Connection Indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                bleStatus === 'connected' && sampleCount > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : bleStatus === 'connected'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title={
                bleStatus === 'connected' && sampleCount > 0
                  ? `ECG Sensor Streaming (${sampleCount.toLocaleString()} samples)`
                  : bleStatus === 'connected'
                  ? 'Sensor Connected — Waiting for data'
                  : 'Sensor Disconnected'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  bleStatus === 'connected' && sampleCount > 0
                    ? 'bg-emerald-500 animate-pulse'
                    : bleStatus === 'connected'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-300'
                }`}
              />
              <span className="text-[11px] font-medium">
                {bleStatus === 'connected' && sampleCount > 0
                  ? 'Receiving ECG'
                  : bleStatus === 'connected'
                  ? 'Sensor Waiting'
                  : 'Sensor Disconnected'}
              </span>
            </div>

            {/* User Profile & Sign Out */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                    ) : user.displayName ? (
                      user.displayName.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[130px]">
                      {user.displayName || user.email || 'Investigator'}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {user.isDemoUser ? 'Local Demo' : 'Authorized'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={signOut}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
