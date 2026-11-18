import React, { useEffect, useState, useRef } from 'react';
import { 
  MapPin, 
  PhoneCall, 
  MessageSquare, 
  CheckCircle, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  ShieldAlert 
} from 'lucide-react';
import { BlePacket, EmergencyContact } from '../../types/ble';

interface EmergencyModalProps {
  latestPacket: BlePacket | null;
  onDismiss: () => void;
}

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'c1',
    name: 'Primary Emergency Contact',
    phone: '+919876543210',
    relationship: 'Family / Guardian',
    notifyOnSOS: true,
  },
  {
    id: 'c2',
    name: 'Cardiologist On-Call',
    phone: '+919811223344',
    relationship: 'Physician',
    notifyOnSOS: true,
  },
];

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ latestPacket, onDismiss }) => {
  const [contacts] = useState<EmergencyContact[]>(() => {
    try {
      const stored = localStorage.getItem('cardiac_twin_emergency_contacts');
      return stored ? JSON.parse(stored) : DEFAULT_CONTACTS;
    } catch {
      return DEFAULT_CONTACTS;
    }
  });

  const [soundMuted, setSoundMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);

  const isEmergency = latestPacket?.isEmergency === true;
  const isDispatched = latestPacket?.alarmState === 'dispatched' || (latestPacket?.countdownSeconds ?? 1) <= 0;
  const secondsLeft = latestPacket?.countdownSeconds ?? 30;
  const reason = latestPacket?.alarmReason?.replace(/_/g, ' ') || 'SEVERE CARDIAC EVENT';
  const lat = latestPacket?.gpsLat || 0;
  const lon = latestPacket?.gpsLon || 0;
  const hasGps = Math.abs(lat) > 0.0001 && Math.abs(lon) > 0.0001;
  const mapsUrl = hasGps 
    ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}` 
    : 'https://www.google.com/maps';

  // Play Web Audio siren without external file dependencies
  const playAlertChirp = () => {
    if (soundMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // Sweep up

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Audio autoplay policy catch
    }
  };

  useEffect(() => {
    if (isEmergency && !soundMuted) {
      playAlertChirp();
      sirenIntervalRef.current = window.setInterval(() => {
        playAlertChirp();
      }, isDispatched ? 400 : 900);
    } else {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
    }
    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
      }
    };
  }, [isEmergency, isDispatched, soundMuted]);

  if (!isEmergency) return null;

  const constructSosMessage = (contact: EmergencyContact) => {
    const coordsStr = hasGps 
      ? `GPS Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}\nLive Map: ${mapsUrl}`
      : 'GPS signal currently acquiring.';
    return encodeURIComponent(
      `🚨 EMERGENCY ALERT for ${contact.name} via Cardiac Digital Twin!\n\n` +
      `Patient alert triggered: ${reason}\n` +
      `Heart Rate: ${latestPacket?.heartRate ? Math.round(latestPacket.heartRate) + ' BPM' : 'Abnormal'}\n` +
      `${coordsStr}\n\n` +
      `Please respond or dispatch assistance immediately.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className={`relative w-full max-w-xl rounded-3xl border-2 shadow-2xl p-6 sm:p-8 space-y-6 bg-white overflow-hidden ${
        isDispatched 
          ? 'border-red-600 ring-8 ring-red-500/20' 
          : 'border-amber-500 ring-8 ring-amber-500/20 animate-pulse'
      }`}>
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isDispatched ? 'bg-red-600 text-white animate-bounce' : 'bg-amber-500 text-white'}`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <span className={`text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${
                isDispatched ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {isDispatched ? 'CRITICAL SOS DISPATCHED' : 'COUNTDOWN ACTIVE (ESP32 BUZZING)'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {isDispatched ? 'Emergency Broadcast Sent' : 'Abnormal Cardiac Event Detected'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={soundMuted ? 'Unmute siren' : 'Mute siren'}
          >
            {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-red-500 animate-pulse" />}
          </button>
        </div>

        {/* Reason & Countdown Banner */}
        <div className={`p-4 rounded-2xl border ${
          isDispatched 
            ? 'bg-red-50 border-red-200 text-red-900' 
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Identified Condition</span>
              <span className="text-lg font-black text-red-600 block">{reason}</span>
            </div>

            {!isDispatched && (
              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Cancel Grace Window</span>
                <span className="text-3xl font-black text-amber-600 font-mono tracking-tight">
                  {secondsLeft}s
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 mt-2">
            {!isDispatched 
              ? 'ESP32 active buzzer is pulsing a warning alert. Press the RESET button on your ESP32 board or click below if you are safe.' 
              : 'The 30-second countdown elapsed. Automated emergency location details are prepared for instant broadcast.'}
          </p>
        </div>

        {/* Neo-6M GPS Coordinates Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Neo-6M GPS Telemetry
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              hasGps ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {hasGps ? 'FIX ACQUIRED' : 'ACQUIRING SATELLITES'}
            </span>
          </div>

          <div className="flex items-baseline justify-between font-mono text-xs text-slate-700 pt-1">
            <span>Latitude: <strong>{hasGps ? lat.toFixed(6) : 'Searching...'}</strong></span>
            <span>Longitude: <strong>{hasGps ? lon.toFixed(6) : 'Searching...'}</strong></span>
          </div>

          {hasGps && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 pt-1 underline"
            >
              Open Live Satellite Map in Google Maps
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Emergency Contacts Dispatch Action Grid */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
            Saved Emergency Contacts ({contacts.length})
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {contacts.map((contact) => {
              const msg = constructSosMessage(contact);
              const waUrl = `https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${msg}`;
              const smsUrl = `sms:${contact.phone}?body=${msg}`;

              return (
                <div key={contact.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{contact.name}</h4>
                      <span className="text-[11px] text-slate-400">{contact.relationship} • {contact.phone}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp SOS
                    </a>

                    <a
                      href={smsUrl}
                      className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                      SMS
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={onDismiss}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            I Am Safe — Dismiss Alarm
          </button>
        </div>
      </div>
    </div>
  );
};
