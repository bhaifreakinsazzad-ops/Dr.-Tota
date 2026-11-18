import React, { useState, useEffect } from 'react';
import { getProfile, saveProfile, getSettings, saveSettings, clearAllData, getCoughLogs, getMedications, type PatientProfile, type AppSettings } from '../utils/storage';
import { sendTelegramAlert, openWhatsAppReport } from '../utils/alerts';

const Settings: React.FC = () => {
  const [profile, setProfile] = useState<PatientProfile>(getProfile());
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [telegramTest, setTelegramTest] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleProfileChange = (field: keyof PatientProfile, value: string | number) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    saveProfile(updated);
  };

  const handleSettingsChange = (field: keyof AppSettings, value: any) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramToken || !settings.telegramChatId) {
      setTelegramTest('❌ Telegram Token ও Chat ID দিন');
      return;
    }
    const success = await sendTelegramAlert(
      settings.telegramToken,
      settings.telegramChatId,
      '✅ ডাঃ তোতা থেকে পরীক্ষামূলক বার্তা। সংযোগ সফল!'
    );
    setTelegramTest(success ? '✅ সফলভাবে পাঠানো হয়েছে!' : '❌ পাঠানো যায়নি। Token/Chat ID পরীক্ষা করুন।');
    setTimeout(() => setTelegramTest(''), 5000);
  };

  const handleWhatsAppReport = () => {
    openWhatsAppReport(profile, getCoughLogs(), getMedications());
  };

  const handleClearAll = () => {
    clearAllData();
    setProfile(getProfile());
    setSettings(getSettings());
    setShowClearConfirm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const dialectOptions = ['সহজ প্রমিত বাংলা', 'সিলেটি', 'চট্টগ্রামী', 'নোয়াখালী'];
  const addressOptions = ['মা', 'খালা', 'আম্মা', 'আপা'];

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-5">
      {/* Profile Configuration */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>👤</span> রোগীর তথ্য
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">রোগীর নাম:</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              placeholder="নাম লিখুন"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">সম্বোধন:</label>
            <div className="flex flex-wrap gap-2">
              {addressOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleProfileChange('preferredAddress', opt)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    profile.preferredAddress === opt
                      ? 'bg-emerald-500 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">উপভাষা:</label>
            <select
              value={profile.dialect}
              onChange={(e) => handleProfileChange('dialect', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
            >
              {dialectOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">কাশি কত সপ্তাহ ধরে:</label>
            <input
              type="number"
              min="0"
              value={profile.coughWeeks}
              onChange={(e) => handleProfileChange('coughWeeks', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">পরিচিত সমস্যা:</label>
            <input
              type="text"
              value={profile.conditions}
              onChange={(e) => handleProfileChange('conditions', e.target.value)}
              placeholder="যেমন: প্রেশার, ডায়াবেটিস, গ্যাস্ট্রিক"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
      </section>

      {/* Caregiver Info */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>👨‍👩‍👧</span> পরিচর্যাকারীর তথ্য
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">পরিচর্যাকারীর নাম:</label>
            <input
              type="text"
              value={profile.caregiverName}
              onChange={(e) => handleProfileChange('caregiverName', e.target.value)}
              placeholder="আপনার নাম"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">জরুরি ফোন নম্বর:</label>
            <input
              type="tel"
              value={profile.caregiverPhone}
              onChange={(e) => handleProfileChange('caregiverPhone', e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
      </section>

      {/* Telegram Integration */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>✈️</span> Telegram অ্যালার্ট
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Bot Token:</label>
            <input
              type="text"
              value={settings.telegramToken}
              onChange={(e) => handleSettingsChange('telegramToken', e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Chat ID:</label>
            <input
              type="text"
              value={settings.telegramChatId}
              onChange={(e) => handleSettingsChange('telegramChatId', e.target.value)}
              placeholder="-100123456789"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-xs"
            />
          </div>
          <button
            onClick={handleTestTelegram}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
          >
            ✈️ টেস্ট Telegram অ্যালার্ট পাঠান
          </button>
          {telegramTest && (
            <p className="text-sm text-center font-medium">{telegramTest}</p>
          )}
        </div>
      </section>

      {/* WhatsApp Report */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>💬</span> WhatsApp রিপোর্ট
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          কাশির লগ, ওষুধ তালিকা ও রোগীর তথ্য সহ একটি সম্পূর্ণ রিপোর্ট WhatsApp-এ পাঠান।
        </p>
        <button
          onClick={handleWhatsAppReport}
          className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm transition-colors shadow-md"
        >
          💬 সরাসরি WhatsApp-এ রিপোর্ট পাঠান
        </button>
      </section>

      {/* Accessibility & Speech Controls */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>♿</span> অ্যাক্সেসিবিলিটি ও স্পিচ
        </h3>
        <div className="space-y-4">
          {/* Font Size */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">ফন্ট সাইজ:</label>
            <div className="flex gap-2">
              {[
                { label: 'সাধারণ (1.0x)', value: 1.0 },
                { label: 'বড় (1.15x)', value: 1.15 },
                { label: 'আরও বড় (1.3x)', value: 1.3 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSettingsChange('fontSize', opt.value)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    settings.fontSize === opt.value
                      ? 'bg-emerald-500 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speech Speed */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">
              কথা বলার গতি: {settings.speechRate.toFixed(2)}x
              {settings.speechRate <= 0.9 && <span className="text-emerald-600 ml-1">(বয়স্কদের জন্য উপযুক্ত)</span>}
            </label>
            <input
              type="range"
              min="0.72"
              max="1.15"
              step="0.02"
              value={settings.speechRate}
              onChange={(e) => handleSettingsChange('speechRate', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>🐢 ০.৭২x (ধীর)</span>
              <span>১.১৫x (দ্রুত) 🐇</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-sm text-gray-700">🔲 হাই কন্ট্রাস্ট মোড</span>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) => handleSettingsChange('highContrast', e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-sm text-gray-700">🔊 অটো পড়ে শোনানো</span>
              <input
                type="checkbox"
                checked={settings.autoReadAloud}
                onChange={(e) => handleSettingsChange('autoReadAloud', e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Emergency Contacts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>📞</span> জরুরি হেল্পলাইন
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:999" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-sm font-bold text-red-700">৯৯৯</p>
              <p className="text-xs text-red-600">জাতীয় জরুরি</p>
            </div>
          </a>
          <a href="tel:16263" className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
            <span className="text-xl">🏥</span>
            <div>
              <p className="text-sm font-bold text-blue-700">১৬২৬৩</p>
              <p className="text-xs text-blue-600">শাস্থ্য বাতায়ন</p>
            </div>
          </a>
          <a href="tel:106" className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
            <span className="text-xl">🚑</span>
            <div>
              <p className="text-sm font-bold text-amber-700">১০৬</p>
              <p className="text-xs text-amber-600">ACC এম্বুলেন্স</p>
            </div>
          </a>
          <a href="tel:109" className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors">
            <span className="text-xl">👩‍👧</span>
            <div>
              <p className="text-sm font-bold text-purple-700">১০৯</p>
              <p className="text-xs text-purple-600">নারী ও শিশু</p>
            </div>
          </a>
        </div>
      </section>

      {/* PDPA Data Erasure */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>🔒</span> গোপনীয়তা ও তথ্য মুছুন
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          PDPA 2026 অনুযায়ী আপনার সব ভয়েস ডেটা, কথোপকথন ও কাশির লগ মুছে ফেলুন।
        </p>
        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors"
          >
            🗑️ আজকের সব কথোপকথন ও লগ মুছে ফেলুন
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 font-medium mb-3">
              ⚠️ আপনি কি নিশ্চিত? সব ডেটা স্থায়ীভাবে মুছে যাবে!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm"
              >
                হ্যাঁ, সব মুছুন
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm"
              >
                না, রাখুন
              </button>
            </div>
          </div>
        )}
        {saved && (
          <p className="text-sm text-emerald-600 font-medium text-center mt-2">✅ সব তথ্য মুছে ফেলা হয়েছে।</p>
        )}
      </section>

      {/* Footer Disclaimer */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          🦜 ডাঃ তোতা v1.0 • একটি এআই সহকারী, আসল ডাক্তার নয়
        </p>
      </div>
    </div>
  );
};

export default Settings;
