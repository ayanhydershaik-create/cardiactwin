import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  RotateCcw, 
  Check, 
  Copy, 
  ShieldAlert,
  Sparkles,
  Brain,
  Activity
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  modelUsed?: string;
}

// ─── Clean Clinical Message Formatter (No raw '#' characters) ─────────────

const ClinicalMessageRenderer: React.FC<{ text: string }> = ({ text }) => {
  // Clean raw hash characters if any slip through
  const cleaned = text.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
  const lines = cleaned.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1.5" />;
        }

        // Bold Title / Section header (e.g. **AAMI STANDARDS**)
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <p key={i} className="font-bold text-slate-900 tracking-wide text-xs pt-1 pb-0.5 border-b border-slate-200/50">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        // Bullet points
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
          const content = trimmed.slice(2);
          return (
            <div key={i} className="flex gap-2 items-start pl-1">
              <span className="text-sky-500 font-bold shrink-0 mt-0.5">•</span>
              <span
                className="text-slate-700"
                dangerouslySetInnerHTML={{
                  __html: content
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="bg-slate-100 text-sky-700 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>'),
                }}
              />
            </div>
          );
        }

        // Standard paragraph
        return (
          <p
            key={i}
            className="text-slate-700"
            dangerouslySetInnerHTML={{
              __html: trimmed
                .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
                .replace(/`(.+?)`/g, '<code class="bg-slate-100 text-sky-700 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>'),
            }}
          />
        );
      })}
    </div>
  );
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-0',
    sender: 'assistant',
    text: "**CARDIAC DIGITAL TWIN CLINICAL AI ASSISTANT**\n\nWelcome! I am connected to the **Clinical Knowledge Base**, the **MIT-BIH Arrhythmia Machine Learning pipeline**, and your **PostgreSQL Patient Registry**.\n\nI can analyze:\n• **Patient History & Observations**: Archived rhythm recordings, historical PVC/PAC burden, and biometric trends\n• **AAMI EC57 Arrhythmia Classification**: The 4 clinical heartbeat classes: Normal Sinus (N), Supraventricular Ectopic (S), Ventricular Ectopic (V), and Paced/Artifact (Q)\n• **Machine Learning Features**: 234-sample temporal feature vectors and 300-tree Random Forest decision boundaries\n• **Hardware & Telemetry**: AD8232 biopotentials, MAX30102 optical photoplethysmography (PPG), and SpO2 vital signs\n\nHow can I assist your cardiovascular research today?",
    timestamp: new Date(),
  },
];

const SUGGESTIONS = [
  'Is my current ECG reading normal or showing ectopic beats?',
  'Explain the 4 AAMI heartbeat classes (N, S, V, Q)',
  'Why does the MAX30102 IR reading change with finger contact?',
  'What is the clinical difference between SVEB and PVC?',
  'How do the 234 temporal features feed into the Random Forest model?',
];

export const AssistantView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversation_history: messages.slice(-10).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`AI Agent service returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: data.reply || 'Analysis generated from Clinical Knowledge Base.',
        timestamp: new Date(),
        modelUsed: data.model || 'Clinical RAG Engine',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: `**CLINICAL INFERENCE NOTICE**\n\nConnection notice: ${errMsg}.\n\nPlease verify that your FastAPI backend is running. In the meantime, local morphologic classification remains active on the ECG Monitor and Analysis tabs.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical AI Research Assistant</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Integrated RAG Intelligence trained on MIT-BIH arrhythmia morphology and biopotential telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Clinical RAG Active
          </span>
          <button
            onClick={handleReset}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Reset Conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Research Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-amber-800/90">
          <strong>Academic & Clinical Research Use Only:</strong> This AI agent synthesizes cardiology knowledge and machine learning predictions for investigation and research. It is not an FDA-cleared diagnostic device and must not replace professional clinical evaluation.
        </p>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[580px]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>Cardiac Twin RAG Agent</span>
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[9px] font-mono">v0.3.0</span>
              </h3>
              <p className="text-[10px] text-slate-400">Integrated with AAMI Machine Learning & Sensor Telemetry</p>
            </div>
          </div>
          <Activity className="w-4 h-4 text-sky-500" />
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-sky-600 text-white shadow-xs rounded-br-xs'
                    : 'bg-slate-50 border border-slate-200/80 text-slate-800 shadow-2xs rounded-bl-xs'
                }`}
              >
                {msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap font-sans text-xs">{msg.text}</div>
                ) : (
                  <ClinicalMessageRenderer text={msg.text} />
                )}

                <div className="mt-2 pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="hover:text-slate-600 flex items-center gap-1 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 items-center text-xs text-slate-400 bg-slate-50 p-3 rounded-2xl border border-slate-100 w-fit">
              <Sparkles className="w-4 h-4 text-sky-500 animate-spin" />
              <span>Analyzing ECG features with Clinical Knowledge Base...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="p-2.5 bg-slate-50/50 border-t border-slate-100 overflow-x-auto flex gap-2 no-scrollbar">
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSend(sug)}
              className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-[11px] text-slate-600 whitespace-nowrap shrink-0 transition-colors shadow-2xs"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your live ECG rhythm, waveform morphology, or sensor diagnostics..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantView;
