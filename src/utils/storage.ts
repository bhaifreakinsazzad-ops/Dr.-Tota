// localStorage Management for Dr. Tota
export interface PatientProfile {
  name: string;
  preferredAddress: string;
  dialect: string;
  coughWeeks: number;
  caregiverName: string;
  caregiverPhone: string;
  conditions: string;
}

export interface CoughLog {
  id: string;
  date: string;
  type: 'dry' | 'wet';
  timing: string;
  associated: string[];
  notes: string;
}

export interface Medication {
  id: string;
  brand: string;
  generic: string;
  strength: string;
  drugClass: string;
  schedule: string;
  coughInducing: boolean;
  warningBn: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  isEmergency?: boolean;
}

export interface AppSettings {
  fontSize: number;
  speechRate: number;
  highContrast: boolean;
  purdahMode: boolean;
  autoReadAloud: boolean;
  telegramToken: string;
  telegramChatId: string;
}

const STORAGE_KEYS = {
  profile: 'dr_tota_profile',
  coughLogs: 'dr_tota_cough_logs',
  medications: 'dr_tota_medications',
  chatHistory: 'dr_tota_chat_history',
  settings: 'dr_tota_settings',
};

export function getProfile(): PatientProfile {
  const data = localStorage.getItem(STORAGE_KEYS.profile);
  if (data) return JSON.parse(data);
  return {
    name: '',
    preferredAddress: 'মা',
    dialect: 'সহজ প্রমিত বাংলা',
    coughWeeks: 0,
    caregiverName: '',
    caregiverPhone: '',
    conditions: '',
  };
}

export function saveProfile(profile: PatientProfile): void {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export function getCoughLogs(): CoughLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.coughLogs);
  return data ? JSON.parse(data) : [];
}

export function saveCoughLogs(logs: CoughLog[]): void {
  localStorage.setItem(STORAGE_KEYS.coughLogs, JSON.stringify(logs));
}

export function addCoughLog(log: CoughLog): void {
  const logs = getCoughLogs();
  logs.push(log);
  saveCoughLogs(logs);
}

export function getMedications(): Medication[] {
  const data = localStorage.getItem(STORAGE_KEYS.medications);
  return data ? JSON.parse(data) : [];
}

export function saveMedications(meds: Medication[]): void {
  localStorage.setItem(STORAGE_KEYS.medications, JSON.stringify(meds));
}

export function addMedication(med: Medication): void {
  const meds = getMedications();
  meds.push(med);
  saveMedications(meds);
}

export function removeMedication(id: string): void {
  const meds = getMedications().filter(m => m.id !== id);
  saveMedications(meds);
}

export function getChatHistory(): ChatMessage[] {
  const data = localStorage.getItem(STORAGE_KEYS.chatHistory);
  return data ? JSON.parse(data) : [];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(messages));
}

export function addChatMessage(msg: ChatMessage): void {
  const history = getChatHistory();
  history.push(msg);
  saveChatHistory(history);
}

export function getSettings(): AppSettings {
  const data = localStorage.getItem(STORAGE_KEYS.settings);
  if (data) return JSON.parse(data);
  return {
    fontSize: 1.0,
    speechRate: 0.88,
    highContrast: false,
    purdahMode: false,
    autoReadAloud: true,
    telegramToken: '',
    telegramChatId: '',
  };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}
