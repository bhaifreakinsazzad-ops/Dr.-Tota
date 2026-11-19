import React, { useState, useEffect, useRef } from 'react';
import {
  buildWhatsappSummaryText,
  buildWhatsappShareUrl,
  buildTelegramPayload,
  sendTelegramAlert,
  copyTextToClipboard,
  triggerFileDownload,
} from '../utils/alerts';
import { speakText } from '../utils/speech';
import {
  type DrTotaState,
  type PatientProfile,
  DEFAULT_STATE,
  mergeState,
} from '../utils/storage';

interface SettingsProps {
  state: DrTotaState;
  onUpdateState: (updater: (prev: DrTotaState) => DrTotaState) => void;
  onCompleteErasure: (fromVoice: boolean) => void;
}

const ADDRESS_OPTIONS = ['আম্মুজি', 'মা', 'আম্মা', 'খালা'];
const DIALECT_OPTIONS = [
  'প্রমিত বাংলা ও সহজ চলিত ভাষা',
  'সিলেটি ও চলিত বাংলা মিশ্র',
  'চট্টগ্রামী ও চলিত বাংলা মিশ্র',
  'বাংলা ও বাংলিশ মিশ্র',
];

const Settings: React.FC<SettingsProps> = ({
  state,
  onUpdateState,
  onCompleteErasure,
}) => {
  const [profileDraft, setProfileDraft] = useState<PatientProfile>(state.profile);
  const [profileMsg, setProfileMsg] = useState('');
  const [voiceTestMsg, setVoiceTestMsg] = useState('');
  const [tgFeedback, setTgFeedback] = useState('');
  const [tgPayloadPreview, setTgPayloadPreview] = useState('');
  const [exportFeedback, setExportFeedback] = useState('');
  const [eraseArmed, setEraseArmed] = useState(false);
  const eraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProfileDraft(state.profile);
  }, [state.profile]);

  useEffect(() => {
    return () => {
      if (eraseTimerRef.current) clearTimeout(eraseTimerRef.current);
    };
  }, []);

  const handleSaveProfile = () => {
    onUpdateState((prev) => ({
      ...prev,
      profile: {
        ...profileDraft,
        preferredAddress: profileDraft.preferredAddress || 'আম্মুজি',
        coughWeeks: Number(profileDraft.coughWeeks) || 0,
      },
    }));
    setProfileMsg('প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে');
  };

  const handleSetFontZoom = (zoom: number) => {
    onUpdateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, zoom },
    }));
  };

  const handleToggleContrast = () => {
    onUpdateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, highContrast: !prev.settings.highContrast },
    }));
  };

  const handleRateChange = (val: number) => {
    const clamped = Math.max(0.7, Math.min(1.15, val));
    onUpdateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ttsRate: clamped },
    }));
  };

  const handleTestVoice = () => {
    const addr = state.profile.preferredAddress || 'আম্মুজি';
    const sample = `আসসালামু আলাইকুম ${addr}। আমি ডাঃ তোতা, আপনার কথা ধীরে ও স্পষ্টভাবে পড়ে শোনাচ্ছি।`;
    if (state.settings.purdahMode) {
      setVoiceTestMsg('নিরিবিলি মোড চালু থাকায় শব্দ বন্ধ আছে।');
      return;
    }
    speakText(sample, state.settings.ttsRate, false, false);
    setVoiceTestMsg(`${state.settings.ttsRate}x বয়স্ক-বান্ধব গতিতে কণ্ঠ শোনানো হচ্ছে।`);
  };

  const handleTestTelegramPayload = async () => {
    const updatedProfile = { ...state.profile, tgToken: profileDraft.tgToken, tgChatId: profileDraft.tgChatId };
    onUpdateState((prev) => ({
      ...prev,
      profile: updatedProfile,
    }));

    const payload = buildTelegramPayload(updatedProfile);
    setTgPayloadPreview(
      `Telegram Bot Endpoint: api.telegram.org/bot<TOKEN>/sendMessage\nPayload JSON:\n${JSON.stringify(
        payload,
        null,
        2
      )}`
    );

    if (profileDraft.tgToken.trim() && profileDraft.tgChatId.trim()) {
      const ok = await sendTelegramAlert(
        profileDraft.tgToken.trim(),
        profileDraft.tgChatId.trim(),
        `✅ <b>ডাঃ তোতা</b>: টেলিগ্রাম অ্যালার্ট সংযোগ সফলভাবে কাজ করছে।`
      );
      setTgFeedback(
        ok
          ? 'টেলিগ্রাম সেটিংস সংরক্ষিত ও পরীক্ষামূলক বার্তা পাঠানো হয়েছে!'
          : 'সেটিংস সংরক্ষিত ও নমুনা পেলোড তৈরি হয়েছে (বার্তা পাঠাতে Token/Chat ID যাচাই করুন)'
      );
    } else {
      setTgFeedback('টেলিগ্রাম সেটিংস সংরক্ষিত ও নমুনা পেলোড তৈরি হয়েছে');
    }
  };

  const summaryText = buildWhatsappSummaryText(state);
  const whatsappUrl = buildWhatsappShareUrl(state);

  const handleCopyDoctorSummary = async () => {
    const ok = await copyTextToClipboard(summaryText);
    setExportFeedback(
      ok
        ? 'হোয়াটসঅ্যাপ সারসংক্ষেপ ক্লিপবোর্ডে কপি হয়েছে'
        : 'কপি করা যায়নি — অনুগ্রহ করে উপরের লেখা থেকে কপি করুন'
    );
  };

  const handleDownloadTxt = () => {
    triggerFileDownload(summaryText, 'dr-tota-cough-summary.txt', 'text/plain;charset=utf-8');
    setExportFeedback('টেক্সট ফাইল ডাউনলোড শুরু হয়েছে');
  };

  const handleDownloadJson = () => {
    triggerFileDownload(
      JSON.stringify(state, null, 2),
      'dr-tota-backup.json',
      'application/json;charset=utf-8'
    );
    setExportFeedback('JSON ব্যাকআপ ডাউনলোড হয়েছে');
  };

  const handleJsonRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}')) as Partial<DrTotaState>;
        const restored = mergeState(DEFAULT_STATE, parsed);
        onUpdateState(() => restored);
        setExportFeedback('ব্যাকআপ সফলভাবে পুনরুদ্ধার করা হয়েছে');
      } catch {
        setExportFeedback('সঠিক JSON ব্যাকআপ ফাইল নির্বাচন করুন');
      }
    };
    reader.readAsText(file);
  };

  const handleEraseClick = () => {
    if (!eraseArmed) {
      setEraseArmed(true);
      if (eraseTimerRef.current) clearTimeout(eraseTimerRef.current);
      eraseTimerRef.current = setTimeout(() => {
        setEraseArmed(false);
      }, 5000);
      return;
    }
    setEraseArmed(false);
    if (eraseTimerRef.current) clearTimeout(eraseTimerRef.current);
    onCompleteErasure(false);
  };

  return (
    <section className="tab-panel" id="panel-settings" aria-labelledby="tab-btn-settings">
      <div className="two-col-grid">
        {/* 1. Clean Patient & Caregiver Profile */}
        <div className="card">
          <h2 className="section-heading">আম্মুজি ও পরিবারের প্রোফাইল</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            কোনো কাল্পনিক তথ্য আগে থেকে দেওয়া নেই। পরিবারের সদস্য হিসেবে আম্মুজির প্রকৃত তথ্য এখানে লিখুন।
          </p>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="cfg-mother-name">
                মায়ের নাম
              </label>
              <input
                type="text"
                className="input-control"
                id="cfg-mother-name"
                value={profileDraft.motherName}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, motherName: e.target.value }))
                }
                placeholder="যেমন: সালেহা বেগম বা আম্মুজি"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-address">
                ডাঃ তোতা কী বলে সম্বোধন করবে?
              </label>
              <select
                className="select-control"
                id="cfg-address"
                value={profileDraft.preferredAddress}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, preferredAddress: e.target.value }))
                }
              >
                {ADDRESS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-dialect">
                ভাষা ও আঞ্চলিক ধরন
              </label>
              <select
                className="select-control"
                id="cfg-dialect"
                value={profileDraft.dialect}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, dialect: e.target.value }))
                }
              >
                {DIALECT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-cough-weeks">
                কাশি শুরু হওয়ার সময়কাল (সপ্তাহ)
              </label>
              <input
                type="number"
                min={0}
                max={150}
                step={0.5}
                className="input-control"
                id="cfg-cough-weeks"
                value={profileDraft.coughWeeks}
                onChange={(e) =>
                  setProfileDraft((p) => ({
                    ...p,
                    coughWeeks: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-conditions">
                পূর্বের জানা শারীরিক অবস্থা বা অ্যালার্জি
              </label>
              <input
                type="text"
                className="input-control"
                id="cfg-conditions"
                value={profileDraft.conditions}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, conditions: e.target.value }))
                }
                placeholder="যেমন: উচ্চ রক্তচাপ, ডায়াবেটিস বা জানা নেই"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-caregiver-name">
                দায়িত্বপ্রাপ্ত পরিবারের সদস্যের নাম
              </label>
              <input
                type="text"
                className="input-control"
                id="cfg-caregiver-name"
                value={profileDraft.caregiverName}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, caregiverName: e.target.value }))
                }
                placeholder="যেমন: ভাই সাজ্জাদ"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-caregiver-phone">
                জরুরি মোবাইল নম্বর
              </label>
              <input
                type="tel"
                className="input-control"
                id="cfg-caregiver-phone"
                value={profileDraft.caregiverPhone}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, caregiverPhone: e.target.value }))
                }
                placeholder="যেমন: 017XXXXXXXX"
              />
            </div>
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <button type="button" className="btn btn-primary" onClick={handleSaveProfile}>
              প্রোফাইল সংরক্ষণ করুন
            </button>
            <span className="inline-feedback" id="profile-save-msg">
              {profileMsg}
            </span>
          </div>
        </div>

        {/* 2. Accessibility & Voice Tuning */}
        <div className="card">
          <h2 className="section-heading">অ্যাক্সেসিবিলিটি ও বয়স্ক-বান্ধব কণ্ঠ</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            আম্মুজির দৃষ্টিশক্তি ও শ্রবণশক্তির সুবিধার্থে লেখার আকার, উচ্চ কনট্রাস্ট এবং কণ্ঠের গতি নিয়ন্ত্রণ করুন।
          </p>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <span className="field-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              অক্ষরের আকার (Font Zoom)
            </span>
            <div className="header-actions">
              {[
                { label: '১.০x (স্বাভাবিক)', val: 1 },
                { label: '১.১৫x (বড়)', val: 1.15 },
                { label: '১.৩০x (আরও বড়)', val: 1.3 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`btn btn-sm ${
                    Number(state.settings.zoom) === opt.val ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() => handleSetFontZoom(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <span className="field-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              দৃষ্টি-সহায়ক কনট্রাস্ট মোড
            </span>
            <button
              type="button"
              className="btn btn-soft"
              id="btn-contrast-toggle"
              onClick={handleToggleContrast}
            >
              {state.settings.highContrast
                ? 'উচ্চ কনট্রাস্ট মোড: চালু'
                : 'উচ্চ কনট্রাস্ট মোড: বন্ধ'}
            </button>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="slider-tts-rate">
                বাংলা কণ্ঠের গতি (আদর্শ: ০.৮৮x)
              </label>
              <input
                type="range"
                min={0.7}
                max={1.15}
                step={0.02}
                id="slider-tts-rate"
                value={state.settings.ttsRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0.88)}
                style={{ width: '100%', accentColor: 'var(--primary)', minHeight: '44px' }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-tts-rate">
                গতির মান
              </label>
              <input
                type="number"
                min={0.7}
                max={1.15}
                step={0.02}
                className="input-control"
                id="input-tts-rate"
                value={state.settings.ttsRate}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v)) handleRateChange(v);
                }}
              />
            </div>
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <button type="button" className="btn btn-outline" onClick={handleTestVoice}>
              কণ্ঠ পরীক্ষা করে শুনুন
            </button>
            <span className="inline-feedback" id="voice-test-msg">
              {voiceTestMsg}
            </span>
          </div>
        </div>

        {/* 3. Caregiver Alerts & Telegram Bot Webhook Config */}
        <div className="card">
          <h2 className="section-heading">জরুরি সতর্কতা ও টেলিগ্রাম বট সেটআপ</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            রেড-ফ্ল্যাগ (টিয়ার-০) বা ২৪ ঘণ্টার সতর্কতা (টিয়ার-১) ধরা পড়লে টেলিগ্রাম ওয়েব-হুক পেলোড তৈরি ও পরিবার অ্যালার্ট নথিভুক্ত হবে।
          </p>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="cfg-tg-token">
                Telegram Bot Token (ঐচ্ছিক)
              </label>
              <input
                type="password"
                className="input-control"
                id="cfg-tg-token"
                value={profileDraft.tgToken}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, tgToken: e.target.value }))
                }
                placeholder="যেমন: 123456:ABC-DEF..."
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="cfg-tg-chatid">
                Caregiver Chat ID
              </label>
              <input
                type="text"
                className="input-control"
                id="cfg-tg-chatid"
                value={profileDraft.tgChatId}
                onChange={(e) =>
                  setProfileDraft((p) => ({ ...p, tgChatId: e.target.value }))
                }
                placeholder="যেমন: 987654321"
              />
            </div>
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleTestTelegramPayload}
            >
              টেলিগ্রাম সেটিংস সংরক্ষণ ও নমুনা পেলোড দেখুন
            </button>
            <span className="inline-feedback" id="tg-feedback">
              {tgFeedback}
            </span>
          </div>

          {tgPayloadPreview && (
            <pre
              className="code-preview"
              id="tg-payload-preview"
              style={{ marginTop: 'var(--space-sm)' }}
            >
              {tgPayloadPreview}
            </pre>
          )}

          <h3 className="subhead" style={{ marginTop: 'var(--space-lg)' }}>
            পরিবার সতর্কবার্তা লগ
          </h3>
          <div className="list-stack" id="caregiver-alerts-list">
            {state.alerts.length === 0 ? (
              <div className="empty-state">
                <strong>কোনো জরুরি সতর্কবার্তা তৈরি হয়নি</strong>
                <span>
                  ভয়েস বা ডায়েরিতে কোনো লাল-সংকেত ধরা পড়লে এখানে তারিখ ও কারণ নথিভুক্ত হবে।
                </span>
              </div>
            ) : (
              state.alerts.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className="status-card"
                  data-status={a.level.includes('T0') ? 'alert' : 'warn'}
                >
                  <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
                    <strong>
                      {a.level}: {a.reason}
                    </strong>
                    <span className="kpi-caption">{a.time}</span>
                  </div>
                  <div className="kpi-caption">উদ্ধৃতি: &quot;{a.quote}&quot;</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. One-Tap WhatsApp Summary Exporter & PDPA 2026 Controls */}
        <div className="card">
          <h2 className="section-heading">ডাক্তার ও হোয়াটসঅ্যাপ সারসংক্ষেপ ও PDPA ২০২৬</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            কাশির ডায়েরি, ওষুধের তালিকা এবং এনটিপি টিবি/এক্স-রে চেকলিস্ট এক ক্লিকে কপি বা ডাউনলোড করে হোয়াটসঅ্যাপে পাঠান।
          </p>

          <pre className="code-preview" id="whatsapp-summary-preview">
            {summaryText}
          </pre>

          <div className="header-actions" style={{ marginTop: 'var(--space-md)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopyDoctorSummary}
            >
              হোয়াটসঅ্যাপ সারসংক্ষেপ কপি করুন
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              WhatsApp-এ খুলুন
            </a>
            <button type="button" className="btn btn-outline" onClick={handleDownloadTxt}>
              টেক্সট ডাউনলোড (.txt)
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={handleDownloadJson}>
              JSON ব্যাকআপ
            </button>
          </div>

          {exportFeedback && (
            <span
              className="inline-feedback"
              id="export-feedback"
              style={{ display: 'block', marginTop: 'var(--space-xs)' }}
            >
              {exportFeedback}
            </span>
          )}

          <div className="field-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="field-label" htmlFor="json-restore-input">
              ব্যাকআপ JSON ফাইল থেকে তথ্য পুনরুদ্ধার
            </label>
            <input
              type="file"
              accept=".json"
              className="input-control"
              id="json-restore-input"
              onChange={handleJsonRestore}
            />
          </div>

          <div className="status-card" data-status="alert" style={{ marginTop: 'var(--space-lg)' }}>
            <strong
              className="subhead"
              style={{ marginBottom: 'var(--space-xs)', color: 'var(--error)' }}
            >
              PDPA ২০২৬ তথ্য সুরক্ষা ও সম্পূর্ণ মুছে ফেলা
            </strong>
            <p className="lede" style={{ marginBottom: 'var(--space-sm)' }}>
              বাংলাদেশ ব্যক্তিগত তথ্য সুরক্ষা আইন (PDPA ২০২৬) অনুযায়ী আম্মুজির কথোপকথন, কাশির ডায়েরি ও ওষুধের তথ্য সম্পূর্ণ পরিবারের নিয়ন্ত্রণে থাকে। ভয়েসে{' '}
              <strong>“সব তথ্য মুছে ফেলো”</strong> বললে অথবা নিচের বোতামে দুইবার চাপলে সব সংরক্ষিত তথ্য তাৎক্ষণিক মুছে যাবে।
            </p>
            <button
              type="button"
              className="btn btn-emergency btn-sm"
              id="btn-erase-all"
              onClick={handleEraseClick}
            >
              {eraseArmed
                ? 'নিশ্চিত করতে আরেকবার চাপুন (সব মুছে যাবে)'
                : 'সব তথ্য মুছে ফেলুন (PDPA ২০২৬)'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Settings;
