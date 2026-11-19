import React, { useState, useEffect, useCallback } from 'react';
import { Mic, CheckSquare, Users } from 'lucide-react';
import Header from './components/Header';
import VoiceChat from './components/VoiceChat';
import CoughTracker from './components/CoughTracker';
import Settings from './components/Settings';
import EmergencyModal from './components/EmergencyModal';
import {
  type DrTotaState,
  DEFAULT_STATE,
  loadAppState,
  saveAppState,
  clearAllData,
  createGreetingMessage,
  formatNowBn,
} from './utils/storage';
import { stopSpeaking } from './utils/speech';

type TabId = 'voice' | 'tracker' | 'settings';

const App: React.FC = () => {
  const [state, setState] = useState<DrTotaState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<TabId>('voice');
  const [syncStatus, setSyncStatus] = useState<string>('সংরক্ষিত ও প্রস্তুত');
  const [emergencyOpen, setEmergencyOpen] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('manual');

  // Sync zoom & high-contrast CSS tokens to document root
  useEffect(() => {
    document.documentElement.style.setProperty('--zoom', String(state.settings.zoom || 1));
  }, [state.settings.zoom]);

  const handleUpdateState = useCallback(
    (updater: (prev: DrTotaState) => DrTotaState) => {
      setState((prev) => {
        const next = updater(prev);
        setSyncStatus('সংরক্ষণ হচ্ছে…');
        const saved = saveAppState(next);
        setSyncStatus(saved ? 'সংরক্ষিত' : 'স্থানীয় সেশন');
        return next;
      });
    },
    []
  );

  const handleTogglePurdah = () => {
    handleUpdateState((prev) => {
      const nextPurdah = !prev.settings.purdahMode;
      if (nextPurdah) stopSpeaking();
      return {
        ...prev,
        settings: { ...prev.settings, purdahMode: nextPurdah },
      };
    });
  };

  const handleOpenEmergency = (reason: string) => {
    setEmergencyReason(reason);
    setEmergencyOpen(true);
  };

  const handleCompleteErasure = useCallback((fromVoice: boolean) => {
    stopSpeaking();
    clearAllData();
    const fresh = structuredClone(DEFAULT_STATE);
    fresh.messages = [
      createGreetingMessage(fresh.profile.preferredAddress),
      {
        id: `msg_${Date.now() + 2}`,
        sender: 'bot',
        tier: 'INFO',
        text: fromVoice
          ? 'PDPA ২০২৬ অনুযায়ী আপনার পূর্বের সব কথোপকথন, কাশির ডায়েরি এবং ওষুধের তথ্য সম্পূর্ণ মুছে ফেলা হয়েছে।'
          : 'সব ব্যক্তিগত স্বাস্থ্য তথ্য সফলভাবে মুছে ফেলা হয়েছে।',
        simpleText: 'সব তথ্য মুছে ফেলা হয়েছে।',
        simplified: false,
        timestamp: formatNowBn(),
      },
    ];
    saveAppState(fresh);
    setState(fresh);
    setSyncStatus('সংরক্ষিত');
  }, []);

  const motherLabel = state.profile.motherName || state.profile.preferredAddress || 'আম্মুজি';

  return (
    <div
      className="app-shell"
      id="app-root"
      data-contrast={state.settings.highContrast ? 'high' : 'normal'}
    >
      <div className="page-grid">
        <Header
          purdahMode={state.settings.purdahMode}
          syncStatus={syncStatus}
          onTogglePurdah={handleTogglePurdah}
          onEmergency={() => handleOpenEmergency('manual')}
        />

        {/* Two-Sided Interface Mode Switcher */}
        <nav className="mode-nav" aria-label="প্রধান বিভাগসমূহ">
          <button
            type="button"
            className="mode-tab"
            id="tab-btn-voice"
            aria-selected={activeTab === 'voice'}
            onClick={() => setActiveTab('voice')}
          >
            <Mic size={20} aria-hidden="true" />
            কথা বলুন (আম্মুজি)
          </button>

          <button
            type="button"
            className="mode-tab"
            id="tab-btn-tracker"
            aria-selected={activeTab === 'tracker'}
            onClick={() => setActiveTab('tracker')}
          >
            <CheckSquare size={20} aria-hidden="true" />
            কাশি ও ওষুধ
          </button>

          <button
            type="button"
            className="mode-tab"
            id="tab-btn-settings"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            <Users size={20} aria-hidden="true" />
            পরিবার ও সেটিংস
          </button>
        </nav>

        {activeTab === 'voice' && (
          <VoiceChat
            state={state}
            onUpdateState={handleUpdateState}
            onEmergency={handleOpenEmergency}
            onCompleteErasure={handleCompleteErasure}
          />
        )}

        {activeTab === 'tracker' && (
          <CoughTracker state={state} onUpdateState={handleUpdateState} />
        )}

        {activeTab === 'settings' && (
          <Settings
            state={state}
            onUpdateState={handleUpdateState}
            onCompleteErasure={handleCompleteErasure}
          />
        )}
      </div>

      <EmergencyModal
        isOpen={emergencyOpen}
        reason={emergencyReason}
        motherLabel={motherLabel}
        onClose={() => setEmergencyOpen(false)}
      />
    </div>
  );
};

export default App;
