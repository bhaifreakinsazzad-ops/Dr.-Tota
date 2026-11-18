import React, { useState, useEffect } from 'react';
import { getCoughLogs, addCoughLog, getMedications, addMedication, removeMedication, type CoughLog, type Medication } from '../utils/storage';
import { auditMedicine } from '../utils/drugDatabase';

const CoughTracker: React.FC = () => {
  const [coughLogs, setCoughLogs] = useState<CoughLog[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Cough log form
  const [coughType, setCoughType] = useState<'dry' | 'wet'>('dry');
  const [coughTiming, setCoughTiming] = useState('সারাদিন');
  const [associated, setAssociated] = useState<string[]>([]);

  // Medicine form
  const [medName, setMedName] = useState('');
  const [medSchedule, setMedSchedule] = useState('🌅 ফজরের পর (সকালে)');

  useEffect(() => {
    setCoughLogs(getCoughLogs());
    setMedications(getMedications());
  }, []);

  const symptomOptions = [
    { id: 'fever', label: '🌡️ হালকা জ্বর / ঘাম' },
    { id: 'burning', label: '🔥 বুকে জ্বালা' },
    { id: 'wheeze', label: '🌬️ শাঁই শাঁই শব্দ' },
    { id: 'swelling', label: '🦵 পা ফোলা / হাঁপানো' },
    { id: 'smoke', label: '💨 ধোঁয়া / মশার কয়েল' },
    { id: 'choking', label: '💧 পানি খেতে বিষম' },
  ];

  const scheduleOptions = [
    '🌅 ফজরের পর (সকালে)',
    '☀️ দুপুরের পর',
    '🌇 মাগরিবের পর',
    '🌙 এশার পর (রাতে)',
    '⏰ সকালে খালি পেটে',
  ];

  const toggleAssociated = (id: string) => {
    setAssociated(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleLogCough = () => {
    const log: CoughLog = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' }),
      type: coughType,
      timing: coughTiming,
      associated: associated.map(id => symptomOptions.find(s => s.id === id)?.label || id),
      notes: '',
    };
    addCoughLog(log);
    setCoughLogs(prev => [...prev, log]);
    setAssociated([]);
  };

  const handleAddMedicine = () => {
    if (!medName.trim()) return;
    const audit = auditMedicine(medName);
    const med: Medication = {
      id: Date.now().toString(),
      brand: audit.brand,
      generic: audit.generic,
      strength: audit.strength,
      drugClass: audit.class,
      schedule: medSchedule,
      coughInducing: audit.coughInducing,
      warningBn: audit.warningBn,
    };
    addMedication(med);
    setMedications(prev => [...prev, med]);
    setMedName('');
  };

  const handleRemoveMed = (id: string) => {
    removeMedication(id);
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-6">
      {/* Quick Daily Cough Logger */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>📝</span> আজকের কাশি লগ করুন
        </h3>

        {/* Cough Type Toggle */}
        <div className="mb-3">
          <label className="text-sm font-medium text-gray-600 mb-1 block">কাশির ধরন:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCoughType('dry')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                coughType === 'dry'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              শুকনো (Dry)
            </button>
            <button
              onClick={() => setCoughType('wet')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                coughType === 'wet'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              কফযুক্ত (Wet)
            </button>
          </div>
        </div>

        {/* Timing Toggle */}
        <div className="mb-3">
          <label className="text-sm font-medium text-gray-600 mb-1 block">কখন বেশি হয়:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCoughTiming('🌙 রাতে / শুলে')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                coughTiming === '🌙 রাতে / শুলে'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🌙 রাতে / শুলে
            </button>
            <button
              onClick={() => setCoughTiming('☀️ সকালে / সারাদিন')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                coughTiming === '☀️ সকালে / সারাদিন'
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ☀️ সকালে / সারাদিন
            </button>
          </div>
        </div>

        {/* Associated Symptoms */}
        <div className="mb-3">
          <label className="text-sm font-medium text-gray-600 mb-1 block">সাথে যে লক্ষণ:</label>
          <div className="flex flex-wrap gap-2">
            {symptomOptions.map(s => (
              <button
                key={s.id}
                onClick={() => toggleAssociated(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  associated.includes(s.id)
                    ? 'bg-emerald-500 text-white shadow'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleLogCough}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md"
        >
          ✅ আজকের কাশি লগ করুন
        </button>
      </section>

      {/* Cough Log Timeline */}
      {coughLogs.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>📋</span> কাশির ইতিহাস ({coughLogs.length} টি লগ)
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {[...coughLogs].reverse().map(log => (
              <div key={log.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-xl">
                <span className="text-lg">{log.type === 'dry' ? '🏜️' : '💧'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{log.date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.type === 'dry' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {log.type === 'dry' ? 'শুকনো' : 'কফযুক্ত'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{log.timing}</p>
                  {log.associated.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {log.associated.map((a, i) => (
                        <span key={i} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Medication Audit Panel */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span>💊</span> ওষুধ তালিকা ও পরীক্ষা
        </h3>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
          <p className="text-xs text-yellow-800 font-medium">
            ⚠️ ডাঃ তোতা কোনো ওষুধ সুপারিশ করে না। শুধু তথ্য পরীক্ষা করে। ওষুধ পরিবর্তনের জন্য ডাক্তারের পরামর্শ নিন।
          </p>
        </div>

        {/* Add Medicine Form */}
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={medName}
            onChange={(e) => setMedName(e.target.value)}
            placeholder="ওষুধের নাম (যেমন: Ripril, Sergel)"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <select
            value={medSchedule}
            onChange={(e) => setMedSchedule(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          >
            {scheduleOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={handleAddMedicine}
            disabled={!medName.trim()}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-colors"
          >
            ➕ ওষুধ যোগ করুন
          </button>
        </div>

        {/* Medication Cards */}
        {medications.length > 0 && (
          <div className="space-y-2">
            {medications.map(med => (
              <div key={med.id} className={`p-3 rounded-xl border ${
                med.coughInducing ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{med.brand}</p>
                    <p className="text-xs text-gray-600">{med.generic} • {med.strength}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{med.drugClass}</p>
                    <p className="text-xs text-gray-500">⏰ {med.schedule}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveMed(med.id)}
                    className="text-gray-400 hover:text-red-500 text-lg"
                  >
                    ✕
                  </button>
                </div>
                {med.coughInducing && (
                  <div className="mt-2 bg-amber-100 border border-amber-200 rounded-lg p-2">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ কাশির ঝুঁকি: {med.warningBn}
                    </p>
                  </div>
                )}
                {!med.coughInducing && med.warningBn && (
                  <p className="text-xs text-gray-500 mt-2">{med.warningBn}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CoughTracker;
