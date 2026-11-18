import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VoiceChat from './components/VoiceChat';
import CoughTracker from './components/CoughTracker';
import Settings from './components/Settings';
import EmergencyModal from './components/EmergencyModal';
import { getSettings, saveSettings } from './utils/storage';

type TabId = 'chat' | 'cough' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [purdahMode, setPurdahMode] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyScript, setEmergencyScript] = useState('');
  const [fontSize, setFontSize] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setPurdahMode(settings.purdahMode);
    setFontSize(settings.fontSize);
    setHighContrast(settings.highContrast);
  }, [activeTab]);

  // Refresh settings when switching tabs
  useEffect(() => {
    const interval = setInterval(() => {
      const settings = getSettings();
      setFontSize(settings.fontSize);
      setHighContrast(settings.highContrast);
      setPurdahMode(settings.purdahMode);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleEmergency = (script: string) => {
    setEmergencyScript(script);
    setEmergencyOpen(true);
  };

  const tabs: { id: TabId; label: string; emoji: string }[] = [
    { id: 'chat', label: 'কথা বলুন', emoji: '🎙️' },
    { id: 'cough', label: 'কাশি ও ওষুধ', emoji: '🫁' },
    { id: 'settings', label: 'পরিবার ও সেটিংস', emoji: '👨‍👩‍👧' },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col ${highContrast ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}
      style={{ fontSize: `${fontSize}rem` }}
    >
      <Header
        purdahMode={purdahMode}
        onTogglePurdah={() => {
          const settings = getSettings();
          settings.purdahMode = !settings.purdahMode;
          saveSettings(settings);
          setPurdahMode(!purdahMode);
        }}
        onEmergency={() => {
          setEmergencyScript('শুনুন, এটা খুব জরুরি। এখনই ৯৯৯ নম্বরে কল করুন অথবা পাশের কাউকে ডাকুন।');
          setEmergencyOpen(true);
        }}
      />

      {/* Tab Navigation */}
      <nav className={`sticky top-[72px] z-40 ${highContrast ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="max-w-4xl mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 text-center text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-lg mb-0.5">{tab.emoji}</span>
              <span className="leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {activeTab === 'chat' && <VoiceChat onEmergency={handleEmergency} />}
        {activeTab === 'cough' && <CoughTracker />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        emergencyScript={emergencyScript}
      />
    </div>
  );
};

export default App;
