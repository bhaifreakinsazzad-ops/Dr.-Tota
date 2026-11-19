import React, { useState, useEffect, useCallback } from 'react';
import { Mic, CheckSquare, Users } from 'lucide-react';
import { LayoutGroup, motion, AnimatePresence } from 'motion/react';
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

const NAV_TABS: { id: TabId; domId: string; label: string; icon: React.ReactNode }[] = [
  { id: 'voice', domId: 'tab-btn-voice', label: 'কথা বলুন (আম্মুজি)', icon: <Mic size={20} aria-hidden="true" /> },
  {
    id: 'tracker',
    domId: 'tab-btn-tracker',
    label: 'কাশি, ভাইটালস ও ওষুধ',
    icon: <CheckSquare size={20} aria-hidden="true" />,
  },
  {
    id: 'settings',
    domId: 'tab-btn-settings',
    label: 'ডাক্তার ব্রিফ ও পরিবার',
    icon: <Users size={20} aria-hidden="true" />,
  },
];

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
          motherLabel={motherLabel}
          onTogglePurdah={handleTogglePurdah}
          onEmergency={() => handleOpenEmergency('manual')}
        />

        {/* Two-Sided Interface Mode Switcher with Motion.dev Shared Spring Pill */}
        <LayoutGroup id="dr-tota-mode-nav">
          <nav className="mode-nav" aria-label="প্রধান বিভাগসমূহ">
            {NAV_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className="mode-tab"
                  id={tab.domId}
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {selected && (
                    <motion.span
                      layoutId="active-mode-pill"
                      className="mode-tab-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </LayoutGroup>

        <AnimatePresence mode="wait">
          {activeTab === 'voice' && (
            <motion.div
              key="tab-voice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <VoiceChat
                state={state}
                onUpdateState={handleUpdateState}
                onEmergency={handleOpenEmergency}
                onCompleteErasure={handleCompleteErasure}
              />
            </motion.div>
          )}

          {activeTab === 'tracker' && (
            <motion.div
              key="tab-tracker"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <CoughTracker
                state={state}
                onUpdateState={handleUpdateState}
                onEmergency={handleOpenEmergency}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="tab-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Settings
                state={state}
                onUpdateState={handleUpdateState}
                onCompleteErasure={handleCompleteErasure}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
