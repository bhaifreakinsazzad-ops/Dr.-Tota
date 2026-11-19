import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Check, Circle, Pill, Sparkles } from 'lucide-react';
import { animate, stagger } from 'animejs';
import { motion, AnimatePresence } from 'motion/react';
import AgenticDoctorStage, { type AgentVisualState } from './AgenticDoctorStage';
import { speakText, stopSpeaking, SpeechRecognizer, UniversalAudioRecorder } from '../utils/speech';
import { runDeterministicSafetyCheck, EMERGENCY_SCRIPT_BN } from '../utils/safetyEngine';
import { sendEmergencyTelegram } from '../utils/alerts';
import {
  type DrTotaState,
  type ChatMessage,
  type CoughLog,
  formatNowBn,
  createGreetingMessage,
  getTodayDateKey,
} from '../utils/storage';

interface VoiceChatProps {
  state: DrTotaState;
  onUpdateState: (updater: (prev: DrTotaState) => DrTotaState) => void;
  onEmergency: (reason: string) => void;
  onCompleteErasure: (fromVoice: boolean) => void;
}

interface ChatApiResponse {
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  reply: string;
  simpleText: string;
  emergencyReason: string | null;
  alertNote: string | null;
  detectedDomains: string[];
  suggestedChips: string[];
  shouldAutoLog: boolean;
  autoLogType: string;
  autoLogSeverity: number;
  updatedCoughWeeks: number;
  error?: string;
}

const CORE_QUICK_CHIPS = [
  { label: 'রাতে শুলে কাশি বাড়ে', phrase: 'রাতে শুলে কাশি বাড়ে, ঘুমাতে পারি না', urgent: false },
  { label: 'প্রেশারের ওষুধে কাশি?', phrase: 'আমার প্রেশারের ওষুধে কি এই কাশি হচ্ছে?', urgent: false },
  { label: 'দুই সপ্তাহের বেশি কাশি', phrase: 'দুই সপ্তাহের বেশি সময় ধরে শুকনো কাশি হচ্ছে', urgent: false },
  { label: 'বুকে জ্বালা ও অ্যাসিডিটি', phrase: 'খাওয়ার পর বুকে জ্বালা ও অ্যাসিডিটি লাগে', urgent: false },
  { label: 'কয়েল বা ধোঁয়ায় কাশি', phrase: 'মশার কয়েল বা চুলার ধোঁয়ায় কাশি বাড়ে', urgent: false },
  { label: 'কাশির সাথে রক্ত দেখেছি', phrase: 'আজকে কাশির সাথে একটু রক্ত দেখেছি', urgent: true },
];

const VoiceChat: React.FC<VoiceChatProps> = ({
  state,
  onUpdateState,
  onEmergency,
  onCompleteErasure,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiAudioRecording, setIsAiAudioRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatError, setChatError] = useState('');
  const [micStatus, setMicStatus] = useState('বোতামে চাপ দিয়ে বাংলায় বলুন');
  const [interimText, setInterimText] = useState('এখানে আপনার বলা কথা দেখা যাবে…');

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const audioRecorderRef = useRef<UniversalAudioRecorder | null>(null);
  const audioLevelRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const medProgressRef = useRef<HTMLDivElement>(null);
  const aiChipsRef = useRef<HTMLDivElement>(null);
  const thinkingBarsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    audioRecorderRef.current = new UniversalAudioRecorder();
    return () => {
      audioRecorderRef.current?.cleanup();
      audioLevelRef.current = 0;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, isThinking]);

  const speakWithIndicator = useCallback(
    (text: string, forceEmergency: boolean = false) => {
      void speakText(
        text,
        state.settings.ttsRate,
        state.settings.purdahMode,
        forceEmergency,
        {
          onStart: () => setIsSpeaking(true),
          onEnd: () => {
            audioLevelRef.current = 0;
            setIsSpeaking(false);
          },
          onAudioLevel: (lvl) => {
            audioLevelRef.current = lvl;
          },
        },
        state.settings.useAiVoice
      );
    },
    [state.settings.ttsRate, state.settings.purdahMode, state.settings.useAiVoice]
  );

  const todayKey = getTodayDateKey();
  const todayTakenIds = state.adherence[todayKey] || [];

  const handleToggleMedTaken = (medId: string) => {
    onUpdateState((prev) => {
      const current = prev.adherence[todayKey] || [];
      const nextList = current.includes(medId)
        ? current.filter((id) => id !== medId)
        : [...current, medId];
      return {
        ...prev,
        adherence: {
          ...prev.adherence,
          [todayKey]: nextList,
        },
      };
    });
  };

  const processUserMessage = useCallback(
    async (rawText: string) => {
      const clean = rawText.trim();
      if (!clean || isThinking) return;
      setChatError('');

      // 1. PDPA 2026 Voice Erasure Command Check
      if (clean.includes('সব তথ্য মুছে ফেলো') || clean.includes('সব মুছে ফেল')) {
        onCompleteErasure(true);
        return;
      }

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        sender: 'user',
        text: clean,
        timestamp: formatNowBn(),
      };

      // 2. Deterministic Pre-LLM Red-Flag Check (Tier 0)
      const redFlag = runDeterministicSafetyCheck(clean);
      if (redFlag) {
        const botEmergencyMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'bot',
          tier: 'T0',
          text: EMERGENCY_SCRIPT_BN,
          simpleText: 'এখনই ৯৯৯-এ কল করুন। চুপচাপ বসে পড়ুন, হাঁটবেন না।',
          simplified: false,
          domains: ['জরুরি রেড-ফ্ল্যাগ'],
          timestamp: formatNowBn(),
        };

        onUpdateState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMsg, botEmergencyMsg],
          alerts: [
            {
              id: `al_${Date.now()}`,
              level: 'T0 জরুরি',
              reason: redFlag.label,
              quote: clean,
              time: formatNowBn(),
            },
            ...prev.alerts,
          ],
        }));

        onEmergency(redFlag.label);
        speakWithIndicator(EMERGENCY_SCRIPT_BN, true);
        sendEmergencyTelegram(state.profile, redFlag.label, clean);
        return;
      }

      // Append user message immediately so the stream feels instant
      onUpdateState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
      }));

      setIsThinking(true);
      try {
        const adherenceSummary = `${todayTakenIds.length}/${state.medications.length} টি ওষুধ আজ নেওয়া হয়েছে`;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            history: state.messages.slice(-8),
            profile: state.profile,
            medications: state.medications,
            recentLogs: state.coughLogs.slice(0, 6),
            latestVitals: state.vitalsLogs[0] || null,
            adherenceSummary,
          }),
        });

        const data = (await res.json()) as ChatApiResponse;
        if (!res.ok) {
          throw new Error(data.error || 'এআই সহায়কের উত্তর পেতে সমস্যা হয়েছে।');
        }

        const isT0 = data.tier === 'T0';
        const botMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'bot',
          tier: data.tier,
          text: isT0 ? EMERGENCY_SCRIPT_BN : data.reply,
          simpleText: data.simpleText,
          simplified: false,
          domains: data.detectedDomains,
          suggestedChips: data.suggestedChips,
          timestamp: formatNowBn(),
        };

        const autoLog: CoughLog | null = data.shouldAutoLog
          ? {
              id: `log_${Date.now()}`,
              date: formatNowBn(),
              timestamp: Date.now(),
              weeks:
                data.updatedCoughWeeks > 0
                  ? data.updatedCoughWeeks
                  : Number(state.profile.coughWeeks) || 1,
              type: data.autoLogType || 'শুকনো কাশি (কফ ছাড়া)',
              severity: data.autoLogSeverity || 5,
              domains:
                data.detectedDomains && data.detectedDomains.length > 0
                  ? data.detectedDomains
                  : ['কথোপকথন লগ'],
              note: `কথায় উল্লেখ: ${clean}`,
              tier: data.tier,
            }
          : null;

        onUpdateState((prev) => ({
          ...prev,
          profile:
            data.updatedCoughWeeks > Number(prev.profile.coughWeeks)
              ? { ...prev.profile, coughWeeks: data.updatedCoughWeeks }
              : prev.profile,
          coughLogs: autoLog ? [autoLog, ...prev.coughLogs] : prev.coughLogs,
          alerts:
            isT0 || data.alertNote
              ? [
                  {
                    id: `al_${Date.now()}`,
                    level: isT0 ? 'T0 জরুরি' : `${data.tier} সতর্কতা`,
                    reason: data.emergencyReason || data.alertNote || 'লক্ষণ সতর্কতা',
                    quote: clean,
                    time: formatNowBn(),
                  },
                  ...prev.alerts,
                ]
              : prev.alerts,
          messages: [...prev.messages, botMsg],
        }));

        if (isT0) {
          onEmergency(data.emergencyReason || 'জরুরি স্বাস্থ্য লক্ষণ');
          speakWithIndicator(EMERGENCY_SCRIPT_BN, true);
          sendEmergencyTelegram(state.profile, data.emergencyReason || 'জরুরি লক্ষণ', clean);
        } else {
          speakWithIndicator(data.reply, false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'সংযোগে সমস্যা হয়েছে।';
        setChatError(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [
      isThinking,
      state.messages,
      state.profile,
      state.medications,
      state.coughLogs,
      state.vitalsLogs,
      todayTakenIds.length,
      onUpdateState,
      onEmergency,
      onCompleteErasure,
      speakWithIndicator,
    ]
  );

  // Universal AI Audio Recording (works across all browsers & regional dialects)
  const handleToggleAiAudioRecording = useCallback(async () => {
    if (!audioRecorderRef.current || isTranscribing) return;

    if (isAiAudioRecording) {
      setIsAiAudioRecording(false);
      setIsTranscribing(true);
      setMicStatus('এআই আপনার কণ্ঠ বিশ্লেষণ করছে…');
      try {
        const { audioBase64, mimeType } = await audioRecorderRef.current.stopAndEncode();
        const res = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType,
            dialect: state.profile.dialect,
          }),
        });
        const data = (await res.json()) as { transcript?: string; error?: string };
        if (!res.ok) throw new Error(data.error || 'কণ্ঠ পাঠ করা যায়নি।');
        const transcript = (data.transcript || '').trim();
        if (!transcript) {
          setMicStatus('কোনো স্পষ্ট কথা পাওয়া যায়নি — আবার চেষ্টা করুন');
          return;
        }
        setInterimText(`পাঠানো হয়েছে: "${transcript}"`);
        setMicStatus('বোতামে চাপ দিয়ে বাংলায় বলুন');
        await processUserMessage(transcript);
      } catch (err) {
        setMicStatus(err instanceof Error ? err.message : 'অডিও বিশ্লেষণে সমস্যা হয়েছে।');
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    try {
      setChatError('');
      await audioRecorderRef.current.start();
      setIsAiAudioRecording(true);
      setMicStatus('এখন কথা বলুন… শেষ হলে আবার চাপুন');
      setInterimText('এআই অডিও রেকর্ড হচ্ছে…');
    } catch (err) {
      setMicStatus(err instanceof Error ? err.message : 'মাইক্রোফোন অনুমতি দিন।');
    }
  }, [isAiAudioRecording, isTranscribing, state.profile.dialect, processUserMessage]);

  const handleToggleVoiceRecording = () => {
    if (!recognizerRef.current || !recognizerRef.current.isAvailable()) {
      void handleToggleAiAudioRecording();
      return;
    }

    if (isRecording) {
      recognizerRef.current.stop(true, {
        onFinalSubmit: (spoken) => {
          setInterimText(`পাঠানো হয়েছে: "${spoken}"`);
          void processUserMessage(spoken);
        },
        onEnd: () => {
          setIsRecording(false);
          setMicStatus('বোতামে চাপ দিয়ে বাংলায় বলুন');
        },
      });
      return;
    }

    recognizerRef.current.start({
      onStart: () => {
        setIsRecording(true);
        setMicStatus('এখন ধীরে বাংলায় কথা বলুন…');
        setInterimText('শুনছি…');
      },
      onInterim: (combined) => {
        setInterimText(combined);
      },
      onFinalSubmit: (spoken) => {
        setInterimText(`পাঠানো হয়েছে: "${spoken}"`);
        void processUserMessage(spoken);
      },
      onError: (errMsg) => {
        setIsRecording(false);
        setMicStatus(errMsg);
      },
      onEnd: () => {
        setIsRecording(false);
        setMicStatus('বোতামে চাপ দিয়ে বাংলায় বলুন');
      },
    });
  };

  const handleTextSubmit = () => {
    if (!inputText.trim() || isThinking) return;
    const textToSend = inputText;
    setInputText('');
    void processUserMessage(textToSend);
  };

  const handleRepeat = (msg: ChatMessage) => {
    const toSpeak = msg.simplified && msg.simpleText ? msg.simpleText : msg.text;
    speakWithIndicator(toSpeak, msg.tier === 'T0');
  };

  const handleSimplify = (msg: ChatMessage) => {
    const nextSimplified = !msg.simplified;
    onUpdateState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === msg.id ? { ...m, simplified: nextSimplified } : m
      ),
    }));
    const toSpeak = nextSimplified && msg.simpleText ? msg.simpleText : msg.text;
    speakWithIndicator(toSpeak, msg.tier === 'T0');
  };

  const handleStartNewSession = () => {
    stopSpeaking();
    audioLevelRef.current = 0;
    setIsSpeaking(false);
    setChatError('');
    onUpdateState((prev) => ({
      ...prev,
      messages: [createGreetingMessage(prev.profile.preferredAddress)],
    }));
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    audioLevelRef.current = 0;
    setIsSpeaking(false);
  };

  const lastBotMsg = [...state.messages].reverse().find((m) => m.sender === 'bot');
  const aiSuggestedChips = lastBotMsg?.suggestedChips || [];
  const activeRecording = isRecording || isAiAudioRecording;
  const hasAceRisk = state.medications.some((m) => m.coughRisk === 'HIGH');

  // Anime.js Prayer-Time Medication Adherence Bar Animation
  useEffect(() => {
    if (!medProgressRef.current || state.medications.length === 0) return;
    const pct = Math.round((todayTakenIds.length / state.medications.length) * 100);
    const anim = animate(medProgressRef.current, {
      width: `${pct}%`,
      duration: 560,
      ease: 'outExpo',
    });
    return () => {
      anim.revert();
    };
  }, [todayTakenIds.length, state.medications.length]);

  // Anime.js Staggered AI Quick-Reply Chips Entrance
  useEffect(() => {
    if (!aiChipsRef.current || aiSuggestedChips.length === 0) return;
    const chips = aiChipsRef.current.querySelectorAll('.symptom-chip');
    if (chips.length === 0) return;
    const anim = animate(chips, {
      translateY: [10, 0],
      opacity: [0, 1],
      scale: [0.93, 1],
      duration: 380,
      delay: stagger(55),
      ease: 'outBack(1.4)',
    });
    return () => {
      anim.revert();
    };
  }, [aiSuggestedChips]);

  // Anime.js 6-Domain Diagnostic Thinking Equalizer
  useEffect(() => {
    if (!isThinking || !thinkingBarsRef.current) return;
    const bars = thinkingBarsRef.current.querySelectorAll('.think-eq-bar');
    if (bars.length === 0) return;
    const anim = animate(bars, {
      scaleY: [0.35, 1.0],
      opacity: [0.45, 1.0],
      duration: 360,
      delay: stagger(65, { from: 'center' }),
      loop: true,
      alternate: true,
      ease: 'inOutSine',
    });
    return () => {
      anim.revert();
    };
  }, [isThinking]);

  const agentState: AgentVisualState = useMemo(() => {
    if (lastBotMsg?.tier === 'T0' && !activeRecording && !isThinking) return 'emergency';
    if (activeRecording) return 'listening';
    if (isThinking || isTranscribing) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [lastBotMsg?.tier, activeRecording, isThinking, isTranscribing, isSpeaking]);

  const activeDomains = useMemo(() => {
    const logDomains = state.coughLogs.slice(0, 6).flatMap((l) => [...l.domains, l.note]);
    const msgDomains = state.messages.slice(-6).flatMap((m) => m.domains || []);
    return [...logDomains, ...msgDomains];
  }, [state.coughLogs, state.messages]);

  return (
    <section className="tab-panel" id="panel-voice" aria-labelledby="tab-btn-voice">
      <div className="voice-layout">
        {/* Left Column: 3D Interactive Agentic Doctor Stage + Prayer Meds + Quick Chips + Text Input */}
        <div className="list-stack">
          <AgenticDoctorStage
            agentState={agentState}
            dialectLabel={state.profile.dialect}
            coughWeeks={Number(state.profile.coughWeeks) || 0}
            hasAceRisk={hasAceRisk}
            purdahMode={state.settings.purdahMode}
            micStatus={micStatus}
            interimText={interimText}
            isTranscribing={isTranscribing}
            isAiAudioRecording={isAiAudioRecording}
            isSpeaking={isSpeaking}
            audioLevelRef={audioLevelRef}
            activeDomains={activeDomains}
            onToggleVoice={handleToggleVoiceRecording}
            onToggleAiAudio={() => void handleToggleAiAudioRecording()}
            onStopSpeaking={handleStopSpeaking}
            onAskDomain={(phrase) => void processUserMessage(phrase)}
          />

          {/* Today's Prayer-Time Medication Check-Off */}
          {state.medications.length > 0 && (
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="brand-title-row"
                style={{ justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}
              >
                <div className="flex items-center gap-2">
                  <Pill size={18} className="text-[#0b7a88]" aria-hidden="true" />
                  <h2 className="subhead" style={{ margin: 0 }}>
                    আজকের নামাজের সময় ওষুধ
                  </h2>
                </div>
                <span
                  className="status-text tabular-nums"
                  data-status={todayTakenIds.length === state.medications.length ? 'ok' : 'info'}
                >
                  {todayTakenIds.length}/{state.medications.length} সম্পন্ন
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '999px',
                  background: 'var(--surface-container)',
                  overflow: 'hidden',
                  marginTop: '0.35rem',
                }}
                aria-hidden="true"
              >
                <div
                  ref={medProgressRef}
                  style={{
                    width: '0%',
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #0b7a88, #237a4b)',
                  }}
                />
              </div>
              <div
                className={`list-stack ${state.settings.purdahMode ? 'privacy-blur' : ''}`}
                style={{ gap: '0.5rem', marginTop: 'var(--space-sm)' }}
              >
                {state.medications.map((med) => {
                  const taken = todayTakenIds.includes(med.id);
                  return (
                    <motion.button
                      key={med.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggleMedTaken(med.id)}
                      className="item-row"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: taken ? 'var(--tertiary-soft)' : 'var(--surface-container-low)',
                        padding: '0.75rem 1rem',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>
                          {med.brandName}
                        </div>
                        <div className="meta-line">
                          <span>{med.prayerTime}</span>
                          {med.dose && (
                            <>
                              <span className="meta-sep" aria-hidden="true">·</span>
                              <span>{med.dose}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className="status-text"
                        data-status={taken ? 'ok' : 'info'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {taken ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                        {taken ? 'খেয়েছি' : 'বাকি'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Dynamic Contextual AI Suggestions + Core Quick Symptom Chips */}
          <div className="card">
            <h2 className="subhead">টাইপ না করে এক চাপে জানান</h2>
            <AnimatePresence>
              {aiSuggestedChips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ marginBottom: 'var(--space-md)' }}
                >
                  <div className="kpi-caption" style={{ marginBottom: 'var(--space-xs)', marginTop: 0 }}>
                    প্রশ্নের সহজ উত্তর দিন:
                  </div>
                  <div className="chips-grid" ref={aiChipsRef}>
                    {aiSuggestedChips.map((phrase) => (
                      <motion.button
                        key={phrase}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        className="symptom-chip ai-suggested"
                        disabled={isThinking}
                        onClick={() => void processUserMessage(phrase)}
                      >
                        {phrase}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="kpi-caption" style={{ marginBottom: 'var(--space-xs)', marginTop: 0 }}>
              অন্যান্য জরুরি বা নিয়মিত লক্ষণ:
            </div>
            <div className="chips-grid" id="quick-chips-container">
              {CORE_QUICK_CHIPS.map((chip) => (
                <motion.button
                  key={chip.label}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  className={`symptom-chip ${chip.urgent ? 'urgent-chip' : ''}`}
                  disabled={isThinking}
                  onClick={() => void processUserMessage(chip.phrase)}
                >
                  {chip.label}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="field-group">
              <label className="field-label" htmlFor="chat-text-input">
                লিখে বলুন (বাংলা বা বাংলিশ)
              </label>
              <textarea
                className="textarea-control"
                id="chat-text-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit();
                  }
                }}
                placeholder="যেমন: রাতে শুলে কাশি বাড়ে, বা আজ শরীর দুর্বল লাগছে…"
              />
            </div>
            <div
              className="input-row-end"
              style={{ marginTop: 'var(--space-sm)', justifyContent: 'space-between' }}
            >
              <span className="kpi-caption">এআই সহায়ক ৬টি ডোমেইন অনুযায়ী ছোট প্রশ্ন করবে</span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="btn btn-primary"
                id="btn-send-chat"
                onClick={handleTextSubmit}
                disabled={!inputText.trim() || isThinking}
              >
                {isThinking ? 'ভাবছি…' : 'পাঠান'}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Column: Conversational Stream with Motion.dev Spring Bubbles */}
        <div className="card chat-card">
          <div className="chat-header">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#0b7a88]" aria-hidden="true" />
                <h2 className="subhead" style={{ marginBottom: 0 }}>
                  কথোপকথন ও ক্লিনিক্যাল সহায়তা
                </h2>
              </div>
              <div className="meta-line">
                <span>কণ্ঠের গতি: {state.settings.ttsRate}x</span>
                <span className="meta-sep" aria-hidden="true">·</span>
                <span>{state.settings.useAiVoice ? 'এআই প্রাকৃতিক কণ্ঠ' : 'ডিভাইস কণ্ঠ'}</span>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-outline btn-sm"
              onClick={handleStartNewSession}
            >
              নতুন কথা শুরু
            </motion.button>
          </div>

          {chatError && (
            <div className="error-banner" role="alert">
              {chatError}
            </div>
          )}

          <div className="chat-stream" id="chat-messages" aria-live="polite">
            <AnimatePresence initial={false}>
              {state.messages.map((m) => {
                let cls = `msg-bubble ${m.sender === 'user' ? 'user' : 'bot'}`;
                if (m.tier === 'T0') cls += ' tier-0';
                else if (m.tier === 'T1') cls += ' tier-1';

                const who =
                  m.sender === 'user'
                    ? state.profile.preferredAddress || 'আপনি'
                    : m.tier === 'T0'
                    ? 'জরুরি নির্দেশনা (টিয়ার-০)'
                    : 'ডাঃ তোতা';

                const shouldBlur =
                  state.settings.purdahMode && m.sender === 'bot' && m.tier !== 'T0';

                return (
                  <motion.div
                    key={m.id}
                    className={cls}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  >
                    <div className="msg-meta">
                      <span>
                        {who}
                        {m.domains && m.domains.length > 0 ? ` · ${m.domains.join(' · ')}` : ''}
                      </span>
                      <span className="tabular-nums">{m.timestamp}</span>
                    </div>
                    <p className={`msg-body ${shouldBlur ? 'privacy-blur' : ''}`}>
                      {m.simplified && m.simpleText ? m.simpleText : m.text}
                    </p>
                    {m.sender === 'bot' && (
                      <div className="msg-actions">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          className="btn btn-outline btn-sm"
                          onClick={() => handleRepeat(m)}
                        >
                          আবার শুনুন
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          className="btn btn-soft btn-sm"
                          onClick={() => handleSimplify(m)}
                        >
                          {m.simplified ? 'বিস্তারিত দেখুন' : 'সহজ করে বলুন'}
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isThinking && (
              <motion.div
                className="msg-bubble bot"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="msg-meta">
                  <span>ডাঃ তোতা · ৬-ডোমেইন বিশ্লেষণ</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    ref={thinkingBarsRef}
                    className="flex items-center gap-1 shrink-0"
                    style={{ height: '20px' }}
                    aria-hidden="true"
                  >
                    {[0, 1, 2, 3, 4, 5].map((barIdx) => (
                      <span
                        key={barIdx}
                        className="think-eq-bar"
                        style={{
                          width: '4px',
                          height: '18px',
                          borderRadius: '999px',
                          background: '#0b7a88',
                          display: 'inline-block',
                          transformOrigin: 'center',
                        }}
                      />
                    ))}
                  </div>
                  <p className="msg-body" style={{ color: 'var(--on-surface-variant)', margin: 0 }}>
                    আপনার কথা মন দিয়ে বুঝে উত্তর তৈরি করছি…
                  </p>
                </div>
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VoiceChat;
