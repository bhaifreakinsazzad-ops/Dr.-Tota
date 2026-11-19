export interface PatientProfile {
  motherName: string;
  preferredAddress: string;
  dialect: string;
  coughWeeks: number;
  conditions: string;
  caregiverName: string;
  caregiverPhone: string;
  tgToken: string;
  tgChatId: string;
}

export interface AppSettings {
  zoom: number;
  highContrast: boolean;
  ttsRate: number;
  purdahMode: boolean;
}

export interface CoughLog {
  id: string;
  date: string;
  timestamp?: number;
  weeks: number;
  type: string;
  severity: number;
  breathRate?: number;
  domains: string[];
  note: string;
  tier: 'T0' | 'T1' | 'T2' | 'T3';
}

export interface Medication {
  id: string;
  brandName: string;
  generic: string;
  cls: string;
  coughRisk: 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  note: string;
  prayerTime: string;
  dose: string;
}

export interface CaregiverAlert {
  id: string;
  level: string;
  reason: string;
  quote: string;
  time: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  tier?: 'INFO' | 'T0' | 'T1' | 'T2' | 'T3';
  text: string;
  simpleText?: string;
  simplified?: boolean;
  timestamp: string;
}

export interface DrTotaState {
  profile: PatientProfile;
  settings: AppSettings;
  coughLogs: CoughLog[];
  medications: Medication[];
  alerts: CaregiverAlert[];
  messages: ChatMessage[];
}

const STORAGE_KEY = 'dr_tota_vitals_state_v2';

export const DEFAULT_STATE: DrTotaState = {
  profile: {
    motherName: '',
    preferredAddress: 'আম্মুজি',
    dialect: 'প্রমিত বাংলা ও সহজ চলিত ভাষা',
    coughWeeks: 0,
    conditions: '',
    caregiverName: '',
    caregiverPhone: '',
    tgToken: '',
    tgChatId: '',
  },
  settings: {
    zoom: 1,
    highContrast: false,
    ttsRate: 0.88,
    purdahMode: false,
  },
  coughLogs: [],
  medications: [],
  alerts: [],
  messages: [],
};

export function formatNowBn(): string {
  const now = new Date();
  return (
    now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) +
    ' • ' +
    now.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
  );
}

export function createGreetingMessage(preferredAddress: string = 'আম্মুজি'): ChatMessage {
  const addr = preferredAddress || 'আম্মুজি';
  return {
    id: `msg_${Date.now()}`,
    sender: 'bot',
    tier: 'INFO',
    text: `আসসালামু আলাইকুম ${addr}। আমি ডাঃ তোতা—তবে মনে রাখবেন, আমি আসল ডাক্তার নই, একটি কম্পিউটার প্রোগ্রাম। আজ আপনার কাশি আর শরীরটা কেমন আছে?`,
    simpleText: `আসসালামু আলাইকুম ${addr}। আমি ডাঃ তোতা, আসল ডাক্তার নই। আজ আপনার কাশি কেমন আছে?`,
    simplified: false,
    timestamp: formatNowBn(),
  };
}

export function mergeState(base: DrTotaState, saved: Partial<DrTotaState>): DrTotaState {
  return {
    profile: { ...base.profile, ...(saved.profile || {}) },
    settings: { ...base.settings, ...(saved.settings || {}) },
    coughLogs: Array.isArray(saved.coughLogs) ? saved.coughLogs : [],
    medications: Array.isArray(saved.medications) ? saved.medications : [],
    alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
    messages: Array.isArray(saved.messages) ? saved.messages : [],
  };
}

export function loadAppState(): DrTotaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DrTotaState>;
      const merged = mergeState(DEFAULT_STATE, parsed);
      if (merged.messages.length === 0) {
        merged.messages = [createGreetingMessage(merged.profile.preferredAddress)];
      }
      return merged;
    }
  } catch (err) {
    console.warn('Failed to parse saved Dr. Tota state:', err);
  }
  const initial = structuredClone(DEFAULT_STATE);
  initial.messages = [createGreetingMessage(initial.profile.preferredAddress)];
  return initial;
}

export function saveAppState(state: DrTotaState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Failed to save Dr. Tota state:', err);
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
  [
    'dr_tota_profile',
    'dr_tota_cough_logs',
    'dr_tota_medications',
    'dr_tota_chat_history',
    'dr_tota_settings',
  ].forEach((k) => localStorage.removeItem(k));
}
