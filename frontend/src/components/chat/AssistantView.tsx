import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  RotateCcw, 
  Check, 
  Copy, 
  ShieldAlert 
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  groundedTopic?: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-0',
    sender: 'assistant',
    text: "Hello! I am the Cardiac Information Assistant. I can help explain ECG waveforms, the 234-sample feature windows, standard AAMI rhythm classes (N, S, V, Q), and how to connect your sensor hardware.\n\nPlease note: I am an educational and informational research assistant. I do not provide medical diagnoses or treatment advice.",
    timestamp: new Date(),
    groundedTopic: 'Welcome & Safety',
  },
];

const SUGGESTIONS = [
  'What are the 4 AAMI beat classes?',
  'Why does the model need 234 features?',
  'How do I connect my ECG sensor?',
  'What is the difference between SVEB and PVC?',
  'How does the digital twin modeling work?',
];

export const AssistantView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getKnowledgeResponse = (userPrompt: string): string => {
    const p = userPrompt.toLowerCase();

    // Urgent symptom triage
    if (
      p.includes('chest pain') ||
      p.includes('heart attack') ||
      p.includes('shortness of breath') ||
      p.includes('severe pressure') ||
      p.includes('dizziness')
    ) {
      return "⚠️ URGENT MEDICAL NOTICE: If you or someone around you is experiencing chest pain, pressure, severe shortness of breath, dizziness, or symptoms of a heart attack, please contact your local emergency medical services immediately (such as 911 or 112) or go to the nearest emergency department. This platform is strictly for research and algorithm analysis and cannot evaluate acute clinical emergencies.";
    }

    // Prescription / Treatment
    if (p.includes('medicine') || p.includes('medication') || p.includes('prescribe') || p.includes('treatment') || p.includes('cure')) {
      return "As an informational research assistant, I cannot recommend, prescribe, or adjust medications or clinical treatments. For therapeutic guidance and personalized care, please consult a licensed cardiologist or qualified healthcare professional.";
    }

    // AAMI classes
    if (p.includes('aami') || p.includes('classes') || p.includes('categories') || p.includes('n, s, v, q')) {
      return "The model categorizes heartbeats according to the standard Association for the Advancement of Medical Instrumentation (AAMI) taxonomy:\n\n• Class N (Normal): Typical supraventricular conduction, including sinus rhythm, normal beats, and bundle branch blocks.\n• Class S (Supraventricular Ectopic Beat / SVEB): Premature complexes originating in the atria or AV nodal junction (e.g., PACs).\n• Class V (Ventricular Ectopic Beat / VEB): Premature contractions originating directly in the ventricular myocardium (e.g., PVCs).\n• Class Q (Unclassifiable / Paced): Paced beats or complexes that cannot be categorized due to electrode artifact.";
    }

    // 234 Features
    if (p.includes('234') || p.includes('features') || p.includes('samples') || p.includes('window')) {
      return "The Random Forest classifier expects exactly 234 numerical voltage points per heartbeat, calibrated at a 360 Hz sampling rate:\n\n• Pre-peak duration: 0.25 seconds (90 samples before the R-peak)\n• Post-peak duration: 0.40 seconds (144 samples after the R-peak)\n• Total feature dimension: 90 + 144 = 234 numerical values.\n\nThis window captures the complete depolarization and repolarization morphology (P-QRS-T complex) centered at the R-wave peak.";
    }

    // Connecting sensor
    if (p.includes('connect') || p.includes('bluetooth') || p.includes('sensor') || p.includes('pair')) {
      return "To pair your ECG sensor:\n1. Ensure your computer or phone has Bluetooth enabled and you are using Google Chrome or Microsoft Edge.\n2. Go to the 'ECG Monitor' tab and select 'Connect ECG Sensor'.\n3. Select your device from the browser popup dialog.\n4. Once paired, the sensor streams live 12-bit ADC biopotential packets directly to the 60 FPS medical paper grid.";
    }

    // SVEB vs VEB
    if (p.includes('sveb') || p.includes('pvc') || p.includes('ventricular')) {
      return "• Supraventricular Ectopic Beats (Class S / SVEB) originate above the ventricles (in the atria or AV node). They typically exhibit a normal, narrow QRS complex preceded by an abnormal or premature P wave.\n• Premature Ventricular Contractions (Class V / PVC) arise directly from the ventricular muscle. They present as wide, bizarre QRS complexes (> 120 ms) typically lacking a preceding P wave and followed by a compensatory pause.";
    }

    // Digital twin
    if (p.includes('digital twin') || p.includes('twin')) {
      return "In this platform, a 'Cardiac Digital Twin' is an in silico virtual representation of a subject's electrical heart rhythm. By feeding windowed ECG observations into our machine-learning inference pipeline, the twin mirrors depolarization morphology, quantifies ectopic beat burdens, and tracks electrophysiological anomalies over time.";
    }

    return "I can help explain ECG signal characteristics, the 234-sample feature extraction window, AAMI rhythm classes (N, S, V, Q), or sensor connection procedures. What would you like to explore?";
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const responseText = getKnowledgeResponse(query);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 400);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cardiac Information Assistant</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Ask questions regarding ECG signal mechanics, 234-feature windows, AAMI rhythm classes, and sensor setup.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-amber-800/90">
          <strong>Informational Assistant Notice:</strong> This assistant provides biomedical education and technical explanations of this platform. It does not provide medical diagnoses, clinical validation, or treatment recommendations.
        </p>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[520px]">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">Biomedical Knowledge Assistant</h3>
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Knowledge Base
              </span>
            </div>
          </div>

          <button
            onClick={() => setMessages(INITIAL_MESSAGES)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 space-y-1.5 relative group ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-br-xs'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`text-[10px] font-mono ${
                      msg.sender === 'user' ? 'text-sky-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-bl-xs p-3.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-semibold px-2 shrink-0">Suggestions:</span>
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              className="px-2.5 py-1 bg-white hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded-lg border border-slate-200 shrink-0 transition-colors shadow-2xs"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about AAMI classes, 234 features, or sensor pairing..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none focus:bg-white transition-all text-slate-800"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
