import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { speakText, stopSpeaking, SpeechRecognizer } from '../utils/speech';
import { runDeterministicSafetyCheck, EMERGENCY_SCRIPT_BN } from '../utils/safetyEngine';
import { lookupDrugMatch } from '../utils/drugDatabase';
import { sendEmergencyTelegram } from '../utils/alerts';
import {
  type DrTotaState,
  type ChatMessage,
  type CoughLog,
  formatNowBn,
  createGreetingMessage,
} from '../utils/storage';

interface VoiceChatProps {
  state: DrTotaState;
  onUpdateState: (updater: (prev: DrTotaState) => DrTotaState) => void;
  onEmergency: (reason: string) => void;
  onCompleteErasure: (fromVoice: boolean) => void;
}

function extractWeeksFromText(text: string): number {
  if (text.includes('এক মাস') || text.includes('৪ সপ্তাহ') || text.includes('চার সপ্তাহ')) return 4;
  if (text.includes('তিন সপ্তাহ') || text.includes('৩ সপ্তাহ')) return 3;
  if (text.includes('দুই সপ্তাহ') || text.includes('২ সপ্তাহ')) return 2;
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

interface CompanionReply {
  tier: 'T1' | 'T2' | 'T3';
  text: string;
  simpleText: string;
  alertNote: string | null;
  autoLog: CoughLog | null;
  updatedCoughWeeks?: number;
}

function buildCoughCompanionReply(text: string, state: DrTotaState): CompanionReply {
  const addr = state.profile.preferredAddress || 'আম্মুজি';
  const lower = text.toLowerCase();
  const matchedDrug = lookupDrugMatch(text);
  const hasAceMed = state.medications.some((m) => m.coughRisk === 'HIGH');

  // Case A: Symptom Minimization / Pharmacy Cough Syrup Request
  if (lower.includes('সিরাপ') || lower.includes('দোকান থেকে') || lower.includes('ডাক্তার লাগবে না')) {
    return {
      tier: 'T2',
      text: `${addr}, আপনার কষ্টের কথা ভেবেই বলছি—দোকানের সাধারণ কাশির সিরাপ প্রেশারের ওষুধ বা ভেতরের আসল কারণ সারাতে পারে না। আর নিজে থেকে প্রেশারের ওষুধ বন্ধ করাও বিপজ্জনক। তাই একজন ডাক্তারের পরামর্শ নেওয়া খুব জরুরি। আপনি কি এখন হালকা গরম পানি খাচ্ছেন?`,
      simpleText: `দোকানের সিরাপে আসল কারণ সারে না, ${addr}। দয়া করে ডাক্তার দেখান। কোনো ওষুধ নিজে বন্ধ করবেন না।`,
      alertNote: 'লক্ষণ গুরুত্বহীন মনে করছেন এবং দোকানের সিরাপ খেতে চাচ্ছেন',
      autoLog: null,
    };
  }

  // Case B: Mentions Specific ACE Inhibitor
  if (matchedDrug && matchedDrug.coughRisk === 'HIGH') {
    return {
      tier: 'T2',
      text: `${addr}, আপনার বলা '${matchedDrug.generic}' (${matchedDrug.cls}) শ্রেণির ওষুধে কিছু মানুষের দীর্ঘস্থায়ী শুকনো কাশি হতে পারে। তবে মনে রাখবেন, আমি আসল ডাক্তার নই—দয়া করে নিজে থেকে প্রেশারের ওষুধ বন্ধ করবেন না। ডাক্তারকে দেখিয়ে বিকল্প ওষুধ সম্পর্কে জিজ্ঞাসা করা জরুরি।`,
      simpleText: `এই ওষুধে কারও কারও শুকনো কাশি হয়, ${addr}। নিজে ওষুধ বন্ধ করবেন না, ডাক্তারকে দেখান।`,
      alertNote: `সম্ভাব্য এসিই-ইনহিবিটর (${matchedDrug.generic}) কাশির প্রশ্ন`,
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks: Number(state.profile.coughWeeks) || 2,
        type: 'শুকনো কাশি (কফ ছাড়া)',
        severity: 6,
        domains: ['ওষুধজনিত কাশি (ACE-I)'],
        note: `কথায় উল্লেখ: ${text}`,
        tier: 'T2',
      },
    };
  }

  if (lower.includes('প্রেশারের ওষুধ') || lower.includes('ওষুধে কি কাশি')) {
    const extra = hasAceMed
      ? 'আপনার তালিকায় রক্তচাপের এসিই-ইনহিবিটর জাতীয় ওষুধ রয়েছে, যা থেকে শুকনো কাশি হতে পারে।'
      : "কিছু রক্তচাপের ওষুধে (এসিই-ইনহিবিটর) শুকনো কাশি হতে পারে—তাই আপনার আসল ওষুধের নাম 'কাশি ও ওষুধ' পাতায় যোগ করলে আমি মিলিয়ে দেখতে পারব।";
    return {
      tier: 'T2',
      text: `${addr}, এটি খুব গুরুত্বপূর্ণ একটি বিষয়। ${extra} তবে আমি আসল ডাক্তার নই—নিজে থেকে কোনো প্রেশারের ওষুধ বন্ধ করবেন না। আপনার কাশি কি গলা সুড়সুড় করা শুকনো কাশি, নাকি কফ ওঠে?`,
      simpleText: `কিছু প্রেশারের ওষুধে শুকনো কাশি হয়, ${addr}। নিজে ওষুধ বন্ধ করবেন না। আপনার কি কফ ওঠে নাকি শুকনো কাশি?`,
      alertNote: 'প্রেশারের ওষুধ ও কাশির সম্পর্ক জানতে চেয়েছেন',
      autoLog: null,
    };
  }

  // Case C: Persistent >= 2 Weeks Cough (NTP TB Screening Priority)
  if (lower.includes('সপ্তাহ') || lower.includes('অনেক দিন') || lower.includes('শুকনো কাশি')) {
    const weeks = extractWeeksFromText(text) || Number(state.profile.coughWeeks) || 3;
    return {
      tier: 'T2',
      text: `${weeks} সপ্তাহ ধরে কাশি হওয়াটা শরীরের জন্য খুব ক্লান্তিকর, ${addr}। দুই সপ্তাহের বেশি কাশি থাকলে বাংলাদেশ জাতীয় নিয়ম অনুযায়ী সরকারি স্বাস্থ্যকেন্দ্রে বিনামূল্যে কফ পরীক্ষা (টিবি স্ক্রিনিং) ও বুকের এক্স-রে করানো জরুরি। আপনার কি সন্ধ্যার দিকে হালকা জ্বর বা রাতে ঘাম হয়?`,
      simpleText: `দুই সপ্তাহের বেশি কাশি হলে কফ পরীক্ষা ও বুকের এক্স-রে জরুরি, ${addr}। আপনার কি রাতে জ্বর বা ঘাম হয়?`,
      alertNote: `${weeks} সপ্তাহের দীর্ঘস্থায়ী কাশি (এনটিপি টিবি স্ক্রিনিং প্রযোজ্য)`,
      updatedCoughWeeks: weeks > Number(state.profile.coughWeeks) ? weeks : undefined,
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks,
        type: 'শুকনো কাশি (কফ ছাড়া)',
        severity: 6,
        domains: [`সংক্রমণ ও টিবি (${weeks} সপ্তাহ)`],
        note: text,
        tier: 'T2',
      },
    };
  }

  // Case D: Lying Flat / Nocturnal / Cardiac vs Reflux Check
  if (lower.includes('শুলে') || lower.includes('রাতে') || lower.includes('বালিশ')) {
    return {
      tier: 'T2',
      text: `রাতে শুলেই কাশি উঠলে ঘুম ভেঙে যায়, এটা খুব কষ্টের ${addr}। আমি ডায়েরিতে লিখে রাখলাম। একটি ছোট প্রশ্ন করি—শুলে কি বুকে জ্বালা (অ্যাসিডিটি) লাগে, নাকি শ্বাস নিতে কষ্ট হয় বলে উঁচু বালিশ লাগে?`,
      simpleText: `রাতে শুলে কাশি কষ্টের, ${addr}। শুলে কি বুক জ্বালা করে, নাকি উঁচু বালিশ লাগে?`,
      alertNote: null,
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks: Number(state.profile.coughWeeks) || 1,
        type: 'মিশ্র কাশি (রাতে বাড়ে)',
        severity: 7,
        domains: ['হৃদযন্ত্র / শুলে কাশি', 'রিফ্লাক্স (GERD)'],
        note: text,
        tier: 'T2',
      },
    };
  }

  // Case E: Reflux / Buke Jala
  if (lower.includes('জ্বালা') || lower.includes('অ্যাসিডিটি') || lower.includes('গ্যাস্ট্রিক')) {
    return {
      tier: 'T3',
      text: `বুকে জ্বালা ও অ্যাসিডিটি থেকেও রাতে কাশি বাড়তে পারে, ${addr}। আরামের জন্য রাতে ঘুমানোর অন্তত ২-৩ ঘণ্টা আগে হালকা খাবার খাওয়া এবং মাথা সামান্য উঁচু করে শোয়া সাহায্য করতে পারে। তবে টানা ২ সপ্তাহের বেশি কাশি থাকলে ডাক্তার দেখানো জরুরি।`,
      simpleText: `অ্যাসিডিটিতে কাশি বাড়তে পারে, ${addr}। ঘুমানোর ৩ ঘণ্টা আগে রাতের খাবার খান ও মাথা উঁচু রাখুন।`,
      alertNote: null,
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks: Number(state.profile.coughWeeks) || 1,
        type: 'শুকনো কাশি (কফ ছাড়া)',
        severity: 5,
        domains: ['রিফ্লাক্স (GERD)'],
        note: text,
        tier: 'T3',
      },
    };
  }

  // Case F: Airway / Smoke / Mosquito Coils
  if (lower.includes('কয়েল') || lower.includes('ধোঁয়া') || lower.includes('চুলা') || lower.includes('ধূলা')) {
    return {
      tier: 'T3',
      text: `মশার কয়েল ও রান্নার ধোঁয়া বয়স্কদের শ্বাসনালীতে মারাত্মক জ্বালাপোড়া ও দীর্ঘস্থায়ী কাশি তৈরি করে, ${addr}। ঘরের ভেতর কয়েলের বদলে মশারি ব্যবহার করা এবং জানালা খোলা রাখলে শ্বাসনালী অনেক আরাম পায়। আপনার কি বুকে শাঁই শাঁই শব্দ হয়?`,
      simpleText: `কয়েল ও ধোঁয়ায় কাশি বাড়ে, ${addr}। ঘরে কয়েল বন্ধ করে মশারি ব্যবহার করুন। বুকে কি শাঁই শাঁই শব্দ হয়?`,
      alertNote: null,
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks: Number(state.profile.coughWeeks) || 1,
        type: 'মিশ্র কাশি (রাতে বাড়ে)',
        severity: 5,
        domains: ['শ্বাসনালী ও ধোঁয়া (COPD/Asthma)'],
        note: text,
        tier: 'T3',
      },
    };
  }

  // Case G: Swelling Feet / High Fever (T1 Urgent)
  if (lower.includes('পা ফোলা') || lower.includes('গোড়ালি ফোলা') || lower.includes('বেশি জ্বর')) {
    return {
      tier: 'T1',
      text: `${addr}, কাশির সাথে পা ফোলা বা বেশি জ্বর থাকলে ২৪ ঘণ্টার মধ্যে ডাক্তারের পরীক্ষা করানো প্রয়োজন। আমি পরিবারের সতর্কবার্তায় এটি লিখে রেখেছি। চাইলে এখনই ১৬২৬৩ (স্বাস্থ্য বাতায়ন)-এ ডাক্তারের সাথে কথা বলা যায়।`,
      simpleText: `পা ফোলা বা বেশি জ্বর থাকলে আজই ডাক্তার দেখান, ${addr}। ১৬২৬৩ নম্বরেও কল করতে পারেন।`,
      alertNote: 'টিয়ার-১ সতর্কতা: পা ফোলা বা তীব্র জ্বরের উল্লেখ',
      autoLog: {
        id: `log_${Date.now()}`,
        date: formatNowBn(),
        timestamp: Date.now(),
        weeks: Number(state.profile.coughWeeks) || 1,
        type: 'মিশ্র কাশি (রাতে বাড়ে)',
        severity: 8,
        domains: ['হৃদযন্ত্র / পা ফোলা', 'সংক্রমণ'],
        note: text,
        tier: 'T1',
      },
    };
  }

  // Default Empathetic Companion
  return {
    tier: 'T3',
    text: `আপনার কথা আমি মন দিয়ে শুনেছি, ${addr}। আমি আসল ডাক্তার নই, তবে আপনার কাশির ধরন বুঝে পরিবারের জন্য গুছিয়ে রাখতে সাহায্য করছি। কাশিটা কি শুকনো, নাকি সাথে কফ বা বুকে জ্বালা আছে? হ্যাঁ বা ছোট করে বললে আমি লিখে রাখব।`,
    simpleText: `আমি শুনেছি, ${addr}। আপনার কাশি কি শুকনো নাকি কফ ওঠে? ছোট করে বলুন।`,
    alertNote: null,
    autoLog: null,
  };
}

const QUICK_CHIPS = [
  { label: 'রাতে শুলে কাশি বাড়ে', phrase: 'রাতে শুলে কাশি বাড়ে, ঘুমাতে পারি না', urgent: false },
  { label: 'প্রেশারের ওষুধে কি কাশি হচ্ছে?', phrase: 'প্রেশারের ওষুধে কি কাশি হচ্ছে?', urgent: false },
  { label: 'তিন সপ্তাহ ধরে শুকনো কাশি', phrase: 'তিন সপ্তাহ ধরে শুকনো কাশি, গলা সুড়সুড় করে', urgent: false },
  { label: 'বুকে জ্বালা ও অ্যাসিডিটি', phrase: 'খাওয়ার পর বুকে জ্বালা ও অ্যাসিডিটি লাগে', urgent: false },
  { label: 'কয়েল বা ধোঁয়ায় কাশি বাড়ে', phrase: 'মশার কয়েল জ্বালালে বা ধোঁয়ায় কাশি বাড়ে', urgent: false },
  { label: 'দোকান থেকে কাশির সিরাপ খাব', phrase: 'দোকান থেকে কাশির সিরাপ কিনে খাব, ডাক্তার লাগবে না', urgent: false },
  { label: 'কাশির সাথে একটু রক্ত দেখেছি', phrase: 'আজকে কাশির সাথে একটু রক্ত দেখেছি', urgent: true },
];

const VoiceChat: React.FC<VoiceChatProps> = ({
  state,
  onUpdateState,
  onEmergency,
  onCompleteErasure,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micStatus, setMicStatus] = useState('বোতামে চাপ দিয়ে বাংলায় বলুন');
  const [interimText, setInterimText] = useState('এখানে আপনার বলা কথা দেখা যাবে…');
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const speakWithIndicator = useCallback(
    (text: string, forceEmergency: boolean = false) => {
      speakText(text, state.settings.ttsRate, state.settings.purdahMode, forceEmergency, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    [state.settings.ttsRate, state.settings.purdahMode]
  );

  const processUserMessage = useCallback(
    (rawText: string) => {
      const clean = rawText.trim();
      if (!clean) return;

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

      // 3. Conversational 6-Domain Cough & Medication Reasoning Engine
      const replyObj = buildCoughCompanionReply(clean, state);
      const botMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        sender: 'bot',
        tier: replyObj.tier,
        text: replyObj.text,
        simpleText: replyObj.simpleText,
        simplified: false,
        timestamp: formatNowBn(),
      };

      onUpdateState((prev) => ({
        ...prev,
        profile: replyObj.updatedCoughWeeks
          ? { ...prev.profile, coughWeeks: replyObj.updatedCoughWeeks }
          : prev.profile,
        coughLogs: replyObj.autoLog ? [replyObj.autoLog, ...prev.coughLogs] : prev.coughLogs,
        alerts: replyObj.alertNote
          ? [
              {
                id: `al_${Date.now()}`,
                level: replyObj.tier,
                reason: replyObj.alertNote,
                quote: clean,
                time: formatNowBn(),
              },
              ...prev.alerts,
            ]
          : prev.alerts,
        messages: [...prev.messages, userMsg, botMsg],
      }));

      speakWithIndicator(replyObj.text, false);
    },
    [state, onUpdateState, onEmergency, onCompleteErasure, speakWithIndicator]
  );

  const handleToggleVoiceRecording = () => {
    if (!recognizerRef.current) return;

    if (isRecording) {
      recognizerRef.current.stop(true, {
        onFinalSubmit: (spoken) => {
          setInterimText(`পাঠানো হয়েছে: "${spoken}"`);
          processUserMessage(spoken);
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
        processUserMessage(spoken);
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
    if (!inputText.trim()) return;
    processUserMessage(inputText);
    setInputText('');
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
    setIsSpeaking(false);
    onUpdateState((prev) => ({
      ...prev,
      messages: [createGreetingMessage(prev.profile.preferredAddress)],
    }));
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  return (
    <section className="tab-panel" id="panel-voice" aria-labelledby="tab-btn-voice">
      <div className="voice-layout">
        {/* Left Column: Giant Voice Orb, Privacy Status & Quick Symptom Chips */}
        <div className="list-stack">
          <div className="mic-stage">
            {state.settings.purdahMode && (
              <div
                className="status-card"
                id="purdah-active-banner"
                data-status="warn"
                style={{ width: '100%', textAlign: 'left' }}
              >
                <strong>নিরিবিলি মোড চালু আছে:</strong> পাশে মানুষ থাকায় কথা বলা (শব্দ) বন্ধ রাখা হয়েছে এবং ব্যক্তিগত ওষুধের তথ্য আড়াল করা আছে।
              </div>
            )}

            <button
              type="button"
              className={`mic-orb ${isRecording ? 'recording' : ''}`}
              id="btn-mic-orb"
              onClick={handleToggleVoiceRecording}
              aria-pressed={isRecording}
            >
              <Mic size={44} aria-hidden="true" />
              <span id="mic-orb-label">{isRecording ? 'শুনছি… থামতে চাপুন' : 'কথা বলুন'}</span>
            </button>

            <div>
              <div className="subhead" id="mic-status-text" style={{ marginBottom: 'var(--space-xs)' }}>
                {micStatus}
              </div>
              <div className="kpi-caption" id="mic-sub-status">
                কথার মাঝে কাশি এলে থামবে না — ৫০০ মিলিসেকেন্ড নীরবতা বাফার সক্রিয়
              </div>
            </div>

            <div className="interim-box" id="interim-transcript-box">
              {interimText}
            </div>

            <div className="header-actions" style={{ justifyContent: 'center' }}>
              <span className="chip" data-status="info" id="voice-speed-badge">
                কণ্ঠের গতি: {state.settings.ttsRate}x (বয়স্ক-বান্ধব)
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                id="btn-stop-speak"
                onClick={handleStopSpeaking}
              >
                {isSpeaking ? 'শব্দ থামান (বলছি…)' : 'শব্দ থামান'}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="subhead">টাইপ না করে এক চাপে জানান</h2>
            <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
              নিচের যেকোনো একটি বোতামে চাপ দিলে ডাঃ তোতা তাৎক্ষণিক শুনবে ও উত্তর দেবে:
            </p>
            <div className="chips-grid" id="quick-chips-container">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className={`symptom-chip ${chip.urgent ? 'urgent-chip' : ''}`}
                  onClick={() => processUserMessage(chip.phrase)}
                >
                  {chip.label}
                </button>
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
              <span className="kpi-caption">কথা পরিষ্কার না হলে নিজেই ছোট প্রশ্ন করে মিলিয়ে নেবে</span>
              <button
                type="button"
                className="btn btn-primary"
                id="btn-send-chat"
                onClick={handleTextSubmit}
                disabled={!inputText.trim()}
              >
                পাঠান
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Conversational Stream */}
        <div className="card chat-card">
          <div className="chat-header">
            <div>
              <h2 className="subhead" style={{ marginBottom: 0 }}>
                কথোপকথন ও সহায়তা
              </h2>
              <span className="kpi-caption">
                প্রতিটি উত্তরের নিচে &apos;আবার শুনুন&apos; ও &apos;সহজ করে বলুন&apos; বোতাম রয়েছে
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleStartNewSession}
            >
              নতুন কথা শুরু
            </button>
          </div>

          <div className="chat-stream" id="chat-messages" aria-live="polite">
            {state.messages.map((m) => {
              let cls = `msg-bubble ${m.sender === 'user' ? 'user' : 'bot'}`;
              if (m.tier === 'T0') cls += ' tier-0';
              else if (m.tier === 'T1') cls += ' tier-1';

              const who =
                m.sender === 'user'
                  ? state.profile.preferredAddress || 'আপনি'
                  : m.tier === 'T0'
                  ? 'জরুরি নির্দেশনা (টিয়ার-০)'
                  : 'ডাঃ তোতা (এআই সহায়ক)';

              const shouldBlur =
                state.settings.purdahMode && m.sender === 'bot' && m.tier !== 'T0';

              return (
                <div key={m.id} className={cls}>
                  <div className="msg-meta">
                    <span>{who}</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <p className={`msg-body ${shouldBlur ? 'privacy-blur' : ''}`}>
                    {m.simplified && m.simpleText ? m.simpleText : m.text}
                  </p>
                  {m.sender === 'bot' && (
                    <div className="msg-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleRepeat(m)}
                      >
                        আবার শুনুন
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => handleSimplify(m)}
                      >
                        {m.simplified ? 'বিস্তারিত দেখুন' : 'সহজ করে বলুন'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VoiceChat;
