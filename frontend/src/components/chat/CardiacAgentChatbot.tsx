import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Copy,
  Database,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  toolsUsed?: string[];
  keyUsed?: string;
  isWarning?: boolean;
  isError?: boolean;
}

interface AgentChatResponse {
  reply: string;
  tool_calls: { tool: string; args: Record<string, unknown>; result: string }[];
  key_used: string;
  model: string;
}

interface AgentStatus {
  status: string;
  total_keys_configured: number;
  has_active_keys: boolean;
  agent_tools: string[];
  model: string;
}

interface CardiacAgentChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const API_BASE = '/api';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  get_system_health: <Database className="w-3 h-3" />,
  list_patients: <Stethoscope className="w-3 h-3" />,
  list_ecg_observations: <Zap className="w-3 h-3" />,
  run_ecg_prediction: <Brain className="w-3 h-3" />,
  get_cardiac_knowledge: <Sparkles className="w-3 h-3" />,
};

const TOOL_LABELS: Record<string, string> = {
  get_system_health: 'System Health',
  list_patients: 'Patient Registry',
  list_ecg_observations: 'ECG Observations',
  run_ecg_prediction: 'ECG Prediction',
  get_cardiac_knowledge: 'Knowledge Base',
};

const SUGGESTIONS = [
  'What AAMI classes can the model detect?',
  'How many patients are in the database?',
  'Check system health status',
  'Explain the 234-feature window',
  'List recent ECG observations',
  'How does the digital twin work?',
];

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init-0',
  sender: 'assistant',
  text: `## 🧠 Cardiac Digital Twin AI Agent

I'm your **autonomous AI research assistant** powered by **Gemini 2.0 Flash** with live tool access to:

- 🗄️ **Patient Registry** — Query registered patients
- 📈 **ECG Observations** — Browse recorded sessions  
- 🤖 **ML Prediction** — Run the Random Forest classifier live
- 🏥 **System Health** — Monitor API + database status
- 📚 **Knowledge Base** — Expert ECG & cardiology explanations

I can autonomously chain multiple tools to answer complex research questions.

> ⚠️ **Research use only. Not a clinical diagnostic device.**

What would you like to explore?`,
  timestamp: new Date(),
};

// ─── Markdown Renderer (simple) ────────────────────────────────────────────

function RenderMarkdown({ text }: { text: string }) {
  // Strip raw hash symbols if any exist
  const sanitized = text.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
  const lines = sanitized.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <p key={i} className="font-bold text-slate-900 text-xs mt-1.5 mb-0.5 border-b border-slate-200/50 pb-0.5">{trimmed.slice(2, -2)}</p>;
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-2 border-sky-400 pl-3 py-1 bg-sky-50/60 rounded-r text-xs text-sky-900 my-1">
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
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
        if (trimmed.startsWith('```') || trimmed === '```') {
          return null; // Skip fence markers
        }
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
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const CardiacAgentChatbot: React.FC<CardiacAgentChatbotProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    { role: string; content: string }[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      fetchAgentStatus();
    }
  }, [isOpen]);

  const fetchAgentStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/agent/status`);
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data);
      }
    } catch {
      // Status unavailable
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    setConversationHistory([]);
    setInputText('');
  };

  const sendMessage = useCallback(
    async (textToSend?: string) => {
      const query = (textToSend || inputText).trim();
      if (!query || isTyping) return;

      setInputText('');

      // Emergency medical check (client-side fast path)
      const emergencyPatterns = [
        /heart attack/i, /chest pain/i, /shortness of breath/i,
        /am i dying/i, /call 911/i, /emergency/i,
      ];
      if (emergencyPatterns.some((p) => p.test(query))) {
        const emergencyMsg: ChatMessage = {
          id: `msg-${Date.now()}-emergency`,
          sender: 'assistant',
          text: '⚠️ **URGENT MEDICAL NOTICE**: If you or someone nearby is experiencing a cardiac emergency — call **911 (or your local emergency number)** immediately or go to the nearest emergency department.\n\nThis platform is strictly an investigational research tool and cannot evaluate clinical emergencies.',
          timestamp: new Date(),
          isWarning: true,
        };
        setMessages((prev) => [
          ...prev,
          { id: `msg-${Date.now()}`, sender: 'user', text: query, timestamp: new Date() },
          emergencyMsg,
        ]);
        return;
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        sender: 'user',
        text: query,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      // Add to conversation history
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user', content: query },
      ];

      try {
        const response = await fetch(`${API_BASE}/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            conversation_history: updatedHistory.slice(-20),
          }),
          signal: AbortSignal.timeout(60000), // 60s timeout for agent reasoning
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP ${response.status}`);
        }

        const data: AgentChatResponse = await response.json();

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date(),
          toolsUsed: data.tool_calls?.map((t) => t.tool) || [],
          keyUsed: data.key_used,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setConversationHistory([
          ...updatedHistory,
          { role: 'assistant', content: data.reply },
        ]);
      } catch (err: unknown) {
        const errorText =
          err instanceof Error ? err.message : 'Unknown error occurred';
        const isNoKeys = errorText.includes('not yet activated') || errorText.includes('No Gemini');

        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          sender: 'assistant',
          text: isNoKeys
            ? '⚠️ **Agent Not Yet Activated**\n\nAdd your Gemini API keys to `backend/.env`:\n```\nGEMINI_API_KEY_1=AIzaSy...\nGEMINI_API_KEY_2=AIzaSy...\nGEMINI_API_KEY_3=AIzaSy...\n```\nThen restart the backend server.'
            : `❌ **Agent Error**: ${errorText}\n\nPlease check that the backend server is running on port 8000.`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [inputText, isTyping, conversationHistory]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  // Responsive sizing: on small mobile fill most of the screen, on larger screens use fixed widths
  const panelWidth = isExpanded
    ? 'sm:w-[720px] w-auto'
    : 'sm:w-[420px] w-auto';
  const panelHeight = isExpanded ? 'h-[85vh]' : 'h-[600px] max-h-[80vh]';

  return (
    <div
      className={`fixed ${panelHeight} ${panelWidth} bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all duration-300
        bottom-0 left-0 right-0 rounded-b-none
        sm:bottom-6 sm:left-auto sm:right-6 sm:rounded-2xl`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-t-2xl">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Cardiac AI Agent</p>
          <p className="text-[10px] text-sky-200 leading-tight">
            {agentStatus
              ? agentStatus.has_active_keys
                ? `Gemini 2.0 Flash · ${agentStatus.total_keys_configured} key${agentStatus.total_keys_configured !== 1 ? 's' : ''} active · ${agentStatus.agent_tools?.length ?? 5} tools`
                : '⚠️ No API keys — Add keys to .env'
              : 'Connecting...'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded((p) => !p)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.isWarning ? 'bg-amber-100' : msg.isError ? 'bg-red-100' : 'bg-gradient-to-br from-sky-500 to-indigo-600'}`}>
                {msg.isWarning ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            )}

            <div className={`max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {/* Tools used badge */}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {msg.toolsUsed.map((tool, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] text-indigo-600 font-medium"
                    >
                      {TOOL_ICONS[tool]}
                      {TOOL_LABELS[tool] || tool}
                    </span>
                  ))}
                </div>
              )}

              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-tr-sm'
                    : msg.isWarning
                    ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm'
                    : msg.isError
                    ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-sm'
                    : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm'
                }`}
              >
                {msg.sender === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <RenderMarkdown text={msg.text} />
                )}
              </div>

              {/* Footer: timestamp + copy + key */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] text-slate-400">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.keyUsed && msg.keyUsed !== 'none' && (
                  <span className="text-[10px] text-indigo-400">{msg.keyUsed}</span>
                )}
                {msg.sender === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] text-slate-400 ml-1">Agent reasoning...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggestions (shown when only initial message) ── */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-slate-400 mb-2 font-medium uppercase tracking-wide">Try asking</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.slice(0, isExpanded ? 6 : 4).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 rounded-full transition-colors"
              >
                <ChevronRight className="w-2.5 h-2.5" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-3 py-2.5 border-t border-slate-100">
        <div className="flex gap-2 items-end bg-slate-50 rounded-xl border border-slate-200 focus-within:border-sky-400 focus-within:bg-white transition-colors px-3 py-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI Agent anything about cardiac data..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 placeholder-slate-400 max-h-28"
            style={{ lineHeight: '1.4' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputText.trim() || isTyping}
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          ⚠️ Research only · Not a medical device · Enter to send
        </p>
      </div>
    </div>
  );
};

export default CardiacAgentChatbot;
