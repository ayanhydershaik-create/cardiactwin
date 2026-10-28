import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { bleAdapter } from '../../services/ble/adapter';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  suggestedQuestions?: string[];
  isWarning?: boolean;
}

const KNOWLEDGE_BASE: Array<{
  triggers: RegExp[];
  title: string;
  response: string;
  followUps?: string[];
}> = [
  {
    triggers: [/234/i, /temporal feature/i, /window/i, /feature dimension/i, /samples per beat/i],
    title: '234-Sample Temporal Feature Window',
    response: `### 234-Sample Temporal Feature Extraction Pipeline

In the Cardiac Digital Twin machine-learning architecture, each heartbeat is isolated and transformed into a fixed-length vector of **234 numerical values**:

1. **Pre-Peak Interval (-0.25 seconds)**:
   - Captures atrial depolarization (P-wave) and PR segment.
   - At the **360 Hz** sampling frequency of the MIT-BIH reference standard, $0.25 \\times 360 = 90$ samples prior to the detected R-peak.

2. **R-Peak Alignment (Sample Index 90)**:
   - The ventricular depolarization peak serves as the morphological fiducial anchor.

3. **Post-Peak Interval (+0.40 seconds)**:
   - Captures ventricular depolarization finish (S-wave) and repolarization (ST segment and T-wave).
   - At 360 Hz, $0.40 \\times 360 = 144$ samples following the R-peak.

4. **Total Dimension**:
   - $90 + 144 = 234$ discrete amplitude values.
   - All 234 values must be finite numerical scalars. The backend API validates this constraint strictly via \`POST /predict/heartbeat\`.`,
    followUps: [
      'How does the R-peak detector identify sample 90?',
      'What are the 4 AAMI beat classes?',
      'Why is the sampling rate 360 Hz?'
    ]
  },
  {
    triggers: [/aami/i, /class n/i, /class s/i, /class v/i, /class q/i, /sveb/i, /veb/i, /ectopic/i, /paced/i, /classes/i],
    title: 'AAMI Heartbeat Classifications',
    response: `### Standard AAMI EC57 Beat Classifications

The Association for the Advancement of Medical Instrumentation (AAMI) standard categorizes cardiac beats into four major research classes evaluated by our model:

- **Class N (Normal / Bundle Branch Block)**:
  - Supraventricular beats originating in the SA node with normal ventricular conduction, plus bundle branch blocks (LBBB, RBBB).
  - Characterized by typical narrow QRS complexes and upright T-waves.

- **Class S (Supraventricular Ectopic Beat — SVEB)**:
  - Premature atrial contractions (PACs) or nodal/junctional ectopic beats originating above the ventricles.
  - Frequently exhibit altered P-wave morphologies followed by a normal narrow QRS complex.

- **Class V (Ventricular Ectopic Beat — VEB)**:
  - Premature ventricular contractions (PVCs) originating in the ventricular myocardium.
  - Characterized by widened, bizarre QRS complexes (> 120 ms) discordant with the subsequent T-wave and lacking preceding P-waves.

- **Class Q (Unclassifiable / Paced Beat)**:
  - Artificial electronic pacemaker spikes, fusion beats, or severely corrupted artifact waveforms that cannot be classified into N, S, or V.`,
    followUps: [
      'Explain the 234-feature extraction window',
      'How does the Random Forest classifier calculate probabilities?',
      'Can I test MIT-BIH presets in the Prediction Studio?'
    ]
  },
  {
    triggers: [/r-peak/i, /pan-tompkins/i, /qrs detect/i, /butterworth/i, /f1-score/i, /sensitivity/i],
    title: 'Pan-Tompkins R-Peak Detection Pipeline',
    response: `### Pan-Tompkins QRS & R-Peak Detection

The R-peak extraction engine follows the validated Pan-Tompkins algorithm optimized for ambulatory Lead II electrograms:

1. **Bandpass Filtering**:
   - 3rd-order Butterworth bandpass filter configured from **5.0 Hz to 20.0 Hz** to attenuate muscle tremor (EMG), powerline interference (50/60 Hz), and respiration baseline wander (< 0.5 Hz).

2. **Derivative Operator**:
   - Provides high-slope QRS differentiation ($y[n] = (1/8)(2x[n] + x[n-1] - x[n-3] - 2x[n-4])$) to highlight steep R-waves while suppressing gradual P and T waves.

3. **Non-Linear Squaring**:
   - Point-by-point squaring ($y[n] = x^2[n]$) reinforces high-frequency QRS energy and ensures all values are positive.

4. **Moving Window Integrator**:
   - A 150 ms moving integration window creates smooth energy envelopes for dual adaptive thresholding.

5. **Validation Benchmarks on MIT-BIH**:
   - Sensitivity ($Se$): **100.0%** (2,273 True Positives detected)
   - Precision ($+P$): **99.21%**
   - F1-Score: **99.61%** with 150 ms temporal tolerance.`,
    followUps: [
      'Explain the 234 temporal feature window',
      'What are the AAMI heartbeat classes?',
      'How does the real-time ECG monitor display waveforms?'
    ]
  },
  {
    triggers: [/digital twin/i, /twin concept/i, /in silico/i, /virtual heart/i, /electrophysiology/i],
    title: 'Cardiac Digital Twin Concept',
    response: `### The Cardiac Digital Twin Architecture

In computational physiology, a **Digital Twin** is an in silico virtual representation that dynamically reflects the physiological state of a biological system:

1. **Continuous Telemetry Layer**:
   - Ingests single-lead biopotential signals (such as Lead II) via low-latency Bluetooth Low Energy (BLE) or database observation sessions.

2. **Electrophysiological Feature Slicing**:
   - Segments raw time-series voltages into morphological cardiac cycles aligned by R-peak markers into 234-sample windows.

3. **Machine Learning Mirror**:
   - Employs an ensemble classifier (Random Forest with 300 estimators) to continuously map heartbeat morphology to posterior class distributions (N, S, V, Q).

4. **Investigational Purpose**:
   - Allows biomedical engineers and clinical researchers to simulate rhythm perturbations, study ectopic beat frequencies, and benchmark automated classification without invasive instrumentation.`,
    followUps: [
      'Explain the 234 temporal feature window',
      'What is the difference between Live Hardware and Simulated Demo?',
      'How do I connect a compatible ECG sensor?'
    ]
  },
  {
    triggers: [/hardware/i, /ble/i, /bluetooth/i, /sensor/i, /ad8232/i, /esp32/i, /connect device/i, /gatt/i],
    title: 'Compatible ECG Hardware & Telemetry',
    response: `### Hardware Telemetry & Sensor Integration

The platform includes a Web Bluetooth API telemetry adapter capable of pairing with compatible low-energy wearable ECG sensors:

- **Signal Conditioning**:
  - Compatible with single-lead analog front-ends (such as AD8232 biopotential amplifiers) utilizing right-leg drive feedback and 0.5–40 Hz instrumentation filters.
- **Digitization & Microcontroller**:
  - Connects to Bluetooth Low Energy (BLE 5.0+) microcontrollers configured with 12-bit ADCs sampling at 360 Hz.
- **GATT Protocol**:
  - Uses standard or custom GATT Services and Characteristics notifying raw millivolt telemetry packets to the browser.
- **Advanced Configuration**:
  - You can customize GATT Primary Service UUIDs, Notification Characteristic UUIDs, and sampling frequencies under the **Hardware Configuration** tab.
- **Safety**:
  - If physical hardware is not paired, use **Simulated Demonstration Mode** in the ECG Monitor to inspect the 60 FPS sweep canvas.`,
    followUps: [
      'How does the ECG Monitor work?',
      'What is the Simulated Demo Mode?',
      'Explain the 234-sample feature window'
    ]
  },
  {
    triggers: [/360/i, /sample rate/i, /sampling frequency/i, /hz/i, /lead ii/i, /lead mlii/i],
    title: '360 Hz Sampling Rate & Lead Standard',
    response: `### 360 Hz Sampling Frequency & Lead Standards

- **Why 360 Hz?**:
  - 360 samples/second is the worldwide reference sampling rate established by the MIT-BIH Arrhythmia Database (Beth Israel Hospital & MIT).
  - At 360 Hz, the Nyquist frequency is 180 Hz, comfortably capturing clinical diagnostic ECG bandwidth (0.05 Hz to 150 Hz).
  - Each sample interval ($\Delta t$) equals $\\approx 2.77$ milliseconds, allowing sub-millisecond precision for R-peak timing and QT interval measurements.

- **Lead Configuration (Modified Lead II / MLII)**:
  - Lead II aligns closely with the mean cardiac electrical vector (pointing from the right shoulder down toward the left hip).
  - This orientation yields the highest amplitude R-wave and clearest P and T waves, making it ideal for automated rhythm analysis and machine-learning feature vectors.`,
    followUps: [
      'Explain the 234 temporal feature window',
      'How does the Pan-Tompkins detector work?',
      'What are the AAMI classes?'
    ]
  },
  {
    triggers: [/random forest/i, /probability/i, /model/i, /classifier/i, /300 trees/i, /posterior/i],
    title: 'Random Forest Classification & Posterior Probabilities',
    response: `### Machine Learning Classifier & Probability Estimation

The platform's predictive core is an ensemble **Random Forest Classifier** trained on curated MIT-BIH records:

1. **Ensemble Architecture**:
   - 300 decision trees trained with bootstrap aggregation (bagging).
   - Each split selects from a random subset of the 234 temporal features ($\sqrt{234} \approx 15$ candidate features per node).

2. **Posterior Probability Formulation**:
   - The posterior class probability $P(Y = c \mid \mathbf{x})$ is computed as the fraction of trees voting for class $c$:
   $$P(Y = c \mid \mathbf{x}) = \\frac{1}{T} \\sum_{t=1}^{T} I(h_t(\\mathbf{x}) = c)$$
   where $T = 300$ trees.

3. **Endpoint Integration**:
   - \`POST /predict/heartbeat\` returns:
     - \`predicted_class\`: Argmax class (N, S, V, or Q)
     - \`class_probabilities\`: Normalized dictionary of all four classes
     - \`clinical_use\`: Strictly \`false\` (enforcing regulatory compliance)`,
    followUps: [
      'What are the 4 AAMI classes?',
      'How can I test MIT-BIH presets?',
      'Explain the 234 temporal feature window'
    ]
  },
  {
    triggers: [/status/i, /system/i, /health/i, /backend/i, /database/i, /is it working/i],
    title: 'System Telemetry & Health Checks',
    response: `### System Telemetry Status

The platform actively monitors its underlying microservices:

- **FastAPI Service**: Queried via \`GET /health\` (returns status, service name, and version).
- **PostgreSQL Database**: Queried via \`GET /health/database\` (verifies active relational connection pool and user).
- **Patient & Observation Registry**: Managed through \`GET/POST /patients\` and \`GET/POST /ecg-observations\`.
- **Bluetooth Subsystem**: Monitored locally using the Web Bluetooth API adapter state.

You can inspect all telemetry counters and re-check connection health in real time on the **System Overview** tab.`,
    followUps: [
      'How do I test ML predictions?',
      'How does the ECG Monitor work?',
      'What is the digital twin concept?'
    ]
  }
];

const EMERGENCY_PATTERNS = [
  /heart attack/i,
  /chest pain/i,
  /short of breath/i,
  /am i dying/i,
  /prescribe/i,
  /what medicine/i,
  /should i take/i,
  /diagnose me/i,
  /do i have/i,
  /my symptoms/i,
  /emergency/i,
  /treatment for/i
];

interface CardiacChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const CardiacChatbot: React.FC<CardiacChatbotProps> = ({ isOpen, onClose, onNavigateTab: _onNavigateTab }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `Hello! I am the **Cardiac Information Assistant**, an educational and technical research companion for the **Cardiac Digital Twin** platform.

I can assist you with:
- **234-Sample Temporal Feature Windows** & Signal Preprocessing
- **AAMI Beat Classifications** (Classes N, S, V, Q)
- **Pan-Tompkins R-Peak Detection** & 3rd-Order Butterworth Filtering
- **In Silico Digital Twin Modeling** & Electrophysiology Concepts
- **Machine Learning Inference** & Posterior Class Probability Interpretation
- **Sensor Hardware Interfaces** & Web Bluetooth Setup

*Please note: I am an informational research assistant and NOT a medical diagnostic tool or physician. I do not diagnose conditions or prescribe medications.*`,
      timestamp: new Date(),
      suggestedQuestions: [
        'Explain the 234 temporal feature window',
        'What are the AAMI classes (N, S, V, Q)?',
        'How does the Pan-Tompkins R-peak detector work?',
        'What does the Cardiac Digital Twin represent?',
        'How does the Random Forest model calculate probabilities?'
      ]
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Evaluate answer with medical safety guardrails
    setTimeout(async () => {
      // 1. Check for emergency/clinical diagnosis queries
      const isEmergency = EMERGENCY_PATTERNS.some((pattern) => pattern.test(query));
      if (isEmergency) {
        const warningMessage: ChatMessage = {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          isWarning: true,
          text: `### ⚠️ Important Medical Safety Notice

**I am an informational research assistant and NOT a medical physician or diagnostic tool.**

I cannot evaluate personal symptoms, confirm or rule out diagnoses, or prescribe treatments or medications.

- **If you are experiencing chest pain, tightness, shortness of breath, dizziness, or suspect a heart attack:**
  - **Please contact your local emergency number (such as 911 or 112) or go to the nearest emergency department immediately.**
- **If you are seeking clinical interpretation of your heart rhythm:**
  - **Please consult a qualified cardiologist or healthcare professional with certified diagnostic equipment.**

Within this platform, I can happily explain the **mathematical algorithms**, **MIT-BIH reference benchmarks**, **234-feature extraction windows**, and **machine-learning classifiers** used in digital twin research.`,
          timestamp: new Date(),
          suggestedQuestions: [
            'Explain the 234 temporal feature window',
            'What are the AAMI beat classes?',
            'What is the difference between Live Hardware and Simulated Demo?'
          ]
        };
        setMessages((prev) => [...prev, warningMessage]);
        setIsTyping(false);
        return;
      }

      // 2. Query Knowledge Base
      let matched = KNOWLEDGE_BASE.find((entry) =>
        entry.triggers.some((regex) => regex.test(query))
      );

      // 3. System status query check
      if (/system status|is api online|check connection/i.test(query)) {
        try {
          const health = await apiClient.getHealth();
          const bleStatus = bleAdapter.getStatus();
          const statusText = `### Live Telemetry Query Results:
- **FastAPI Core**: \`${health.status.toUpperCase()}\` (Service: ${health.service})
- **Hardware Telemetry (BLE)**: \`${bleStatus.toUpperCase()}\`
- **Model Endpoint**: Active on \`POST /predict/heartbeat\` (RandomForest 300 Trees)
- **Sampling Frequency Reference**: 360 Hz standard`;

          setMessages((prev) => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: statusText,
              timestamp: new Date(),
              suggestedQuestions: [
                'Explain the 234 temporal feature window',
                'What are the AAMI classes?',
                'How does the Pan-Tompkins detector work?'
              ]
            }
          ]);
          setIsTyping(false);
          return;
        } catch {
          // Fall through to standard response
        }
      }

      if (!matched) {
        // Fallback intelligent response
        const fallbackText = `I understand you are asking about: "${query}".

As the **Cardiac Information Assistant**, I specialize in the biomedical signal processing and digital twin components of this platform. Here are key topics I can discuss in detail:

1. **Temporal Heartbeat Windows**: Why each beat is windowed into **234 samples** (-0.25s pre-peak to +0.40s post-peak at 360 Hz).
2. **AAMI Beat Taxonomy**: Characteristics of **Class N** (Normal), **Class S** (SVEB), **Class V** (VEB), and **Class Q** (Paced/Artifact).
3. **R-Peak Extraction**: 3rd-order Butterworth filtering (5–20 Hz) and Pan-Tompkins moving window integration achieving **99.61% F1-score**.
4. **Digital Twin Concept**: How in silico modeling mirrors cardiac depolarization states.
5. **Sensor Telemetry**: Web Bluetooth streaming from compatible low-energy ECG hardware.

Feel free to choose one of the suggested inquiries below, or ask a specific electrophysiology question!`;

        setMessages((prev) => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: fallbackText,
            timestamp: new Date(),
            suggestedQuestions: [
              'Explain the 234 temporal feature window',
              'What is an AAMI Class V (VEB) beat?',
              'How does the Pan-Tompkins R-peak detector work?',
              'What does the Cardiac Digital Twin represent?'
            ]
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: matched.response,
            timestamp: new Date(),
            suggestedQuestions: matched.followUps
          }
        ]);
      }

      setIsTyping(false);
    }, 450);
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: 'Conversation reset. How can I assist you with cardiac electrophysiology, machine learning beat classification, or digital twin modeling?',
        timestamp: new Date(),
        suggestedQuestions: [
          'Explain the 234 temporal feature window',
          'What are the AAMI classes (N, S, V, Q)?',
          'How does the Pan-Tompkins R-peak detector work?'
        ]
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cardiac Information Assistant"
      className={`fixed z-50 transition-all duration-300 ease-out flex flex-col bg-white shadow-2xl border border-slate-200 overflow-hidden ${
        isExpanded
          ? 'inset-3 sm:inset-6 md:inset-12 rounded-2xl'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[460px] h-[82vh] sm:h-[620px] max-h-[750px] rounded-2xl'
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-teal-600 text-white p-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-tight text-white">Cardiac Information Assistant</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/25 border border-emerald-300/40 text-emerald-100">
                AI Research
              </span>
            </div>
            <p className="text-[11px] text-sky-100/90 leading-tight">
              Electrophysiology & Machine Learning Companion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:block"
            title={isExpanded ? 'Restore size' : 'Expand window'}
            aria-label={isExpanded ? 'Restore size' : 'Expand window'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={clearChat}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Regulatory Safety Disclaimer Header Banner */}
      <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-start gap-2.5 text-[11px] text-amber-900 shrink-0">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-snug">
          <strong>Research Notice:</strong> Informational research assistant grounded in MIT-BIH & digital twin data. Not a diagnostic tool or physician. Does not prescribe therapies or validate clinical diagnoses.
        </p>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium px-1">
                {isUser ? (
                  <>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>You</span>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px]">
                      <Bot className="w-2.5 h-2.5" />
                    </div>
                    <span>Cardiac Assistant</span>
                    <span>•</span>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 text-xs relative group ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-tr-xs shadow-xs'
                    : msg.isWarning
                    ? 'bg-amber-50 text-amber-950 border border-amber-300 rounded-tl-xs shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs'
                }`}
              >
                {/* Text Content */}
                <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
                  {msg.text.split('\n\n').map((paragraph, idx) => {
                    if (paragraph.startsWith('### ')) {
                      return (
                        <h4 key={idx} className="font-bold text-sm tracking-tight text-slate-900 border-b border-slate-100 pb-1">
                          {paragraph.replace('### ', '')}
                        </h4>
                      );
                    }
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      return (
                        <p key={idx} className="font-bold text-slate-900">
                          {paragraph.replace(/\*\*/g, '')}
                        </p>
                      );
                    }
                    return <p key={idx}>{paragraph}</p>;
                  })}
                </div>

                {/* Copy button for assistant responses */}
                {!isUser && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded bg-white/80 border border-slate-200/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy response"
                    aria-label="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {/* Suggested Follow-Up Prompt Chips */}
              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[92%] sm:max-w-[85%]">
                  {msg.suggestedQuestions.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      onClick={() => handleSendMessage(q)}
                      className="text-[11px] font-medium text-sky-700 bg-sky-50/80 hover:bg-sky-100/90 border border-sky-200/80 rounded-full px-2.5 py-1 text-left transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-sky-500 shrink-0" />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 max-w-[120px] shadow-2xs">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-[11px] text-slate-400 font-medium ml-1">Analyzing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about 234 features, AAMI classes, R-peaks, or telemetry..."
            className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="p-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all shrink-0"
            title="Send inquiry"
            aria-label="Send inquiry"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>Grounded in MIT-BIH & Cardiac Digital Twin model</span>
          <span>Shift+Enter or Enter to send</span>
        </div>
      </div>
    </div>
  );
};
