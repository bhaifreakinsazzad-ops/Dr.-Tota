import React, { useState, useEffect, useRef } from 'react';
import { FileText, Printer, Loader2 } from 'lucide-react';
import { PredictiveArcCanvas } from '@designcodeio/threeui';
import { animate } from 'animejs';
import { motion } from 'motion/react';
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
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');
  const [eraseArmed, setEraseArmed] = useState(false);
  const eraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefPreviewRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setProfileDraft(state.profile);
  }, [state.profile]);

  useEffect(() => {
    return () => {
      if (eraseTimerRef.current) clearTimeout(eraseTimerRef.current);
    };
  }, []);

  // Anime.js smooth reveal when Doctor Brief updates
  useEffect(() => {
    if (!state.doctorBrief || !briefPreviewRef.current) return;
    const anim = animate(briefPreviewRef.current, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 420,
      ease: 'outCubic',
    });
    return () => {
      anim.revert();
    };
  }, [state.doctorBrief]);

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

  const handleToggleAiVoice = () => {
    onUpdateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, useAiVoice: !prev.settings.useAiVoice },
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
    void speakText(
      sample,
      state.settings.ttsRate,
      false,
      false,
      undefined,
      state.settings.useAiVoice
    );
    setVoiceTestMsg(
      `${state.settings.ttsRate}x গতিতে ${state.settings.useAiVoice ? 'এআই বাংলা' : 'ডিভাইস'} কণ্ঠ শোনানো হচ্ছে।`
    );
  };

  const handleTestTelegramPayload = async () => {
    const updatedProfile = {
      ...state.profile,
      tgToken: profileDraft.tgToken,
      tgChatId: profileDraft.tgChatId,
    };
    onUpdateState((prev) => ({
      ...prev,
      profile: updatedProfile,
    }));

    const payload = buildTelegramPayload(updatedProfile);
    setTgPayloadPreview(
      `Server Proxy Endpoint: POST /api/alerts/telegram\nPayload JSON:\n${JSON.stringify(
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
          : 'সেটিংস সংরক্ষিত হয়েছে (বার্তা পাঠাতে Token/Chat ID যাচাই করুন)'
      );
    } else {
      setTgFeedback('টেলিগ্রাম সেটিংস সংরক্ষিত ও নমুনা পেলোড তৈরি হয়েছে');
    }
  };

  const handleGenerateDoctorBrief = async () => {
    setBriefError('');
    setBriefLoading(true);
    try {
      const res = await fetch('/api/doctor-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      const data = (await res.json()) as { brief?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'ক্লিনিক্যাল ব্রিফ তৈরি করা যায়নি।');
      const briefText = data.brief || '';
      onUpdateState((prev) => ({
        ...prev,
        doctorBrief: briefText,
      }));
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'ত্রুটি হয়েছে।');
    } finally {
      setBriefLoading(false);
    }
  };

  const summaryText = buildWhatsappSummaryText(state);
  const whatsappUrl = buildWhatsappShareUrl(state);

  const handleCopyDoctorSummary = async (textToCopy: string) => {
    const ok = await copyTextToClipboard(textToCopy);
    setExportFeedback(
      ok
        ? 'সারসংক্ষেপ ক্লিপবোর্ডে কপি হয়েছে'
        : 'কপি করা যায়নি — অনুগ্রহ করে উপরের লেখা থেকে কপি করুন'
    );
  };

  const handleDownloadTxt = () => {
    const content = state.doctorBrief ? `${state.doctorBrief}\n\n${summaryText}` : summaryText;
    triggerFileDownload(content, 'dr-tota-cough-summary.txt', 'text/plain;charset=utf-8');
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
      {/* Full-width AI Clinical Doctor Brief Card with ThreeUI Header Strip */}
      <div className="card">
        <div className="threeui-telemetry-frame no-print" style={{ marginBottom: 'var(--space-md)', minHeight: '96px' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.65,
            }}
            aria-hidden="true"
          >
            <PredictiveArcCanvas variant="predictive" mode="dark" hue={192} speed={0.75} />
          </div>
          <div className="threeui-telemetry-overlay">
            <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
              <div className="flex items-center gap-2">
                <FileText size={22} className="text-[#38e2f4]" aria-hidden="true" />
                <h2 className="section-heading" style={{ margin: 0, color: '#e8f8fb' }}>
                  ডাক্তারের জন্য এআই ক্লিনিক্যাল ব্রিফ (বাংলা ও ইংরেজি)
                </h2>
              </div>
              <div className="header-actions no-print">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="btn btn-primary btn-sm"
                  disabled={briefLoading}
                  onClick={() => void handleGenerateDoctorBrief()}
                >
                  {briefLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>তৈরি হচ্ছে…</span>
                    </>
                  ) : (
                    <span>এআই ডাক্তার ব্রিফ তৈরি করুন</span>
                  )}
                </motion.button>
                {state.doctorBrief && (
                  <>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-stage-ghost btn-sm"
                      onClick={() => void handleCopyDoctorSummary(state.doctorBrief)}
                    >
                      ব্রিফ কপি করুন
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-stage-ghost btn-sm"
                      onClick={() => window.print()}
                    >
                      <Printer size={16} aria-hidden="true" />
                      <span>প্রিন্ট / PDF</span>
                    </motion.button>
                  </>
                )}
              </div>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--label-size)', color: '#b4dce4' }}>
              চিকিৎসকের চেম্বারে দেখানোর জন্য কাশির ৬-ডোমেইন ইতিহাস, ভাইটালস, ওষুধের তালিকা (ACE-I সতর্কতা) ও টিবি স্ক্রিনিংয়ের একপাতার সারসংক্ষেপ তৈরি করুন।
            </p>
          </div>
        </div>

        {briefError && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-sm)' }} role="alert">
            {briefError}
          </div>
        )}

        {state.doctorBrief ? (
          <pre ref={briefPreviewRef} className="code-preview" style={{ maxHeight: '360px' }}>
            {state.doctorBrief}
          </pre>
        ) : (
          <div className="empty-state">
            <strong>এখনো এআই ডাক্তার ব্রিফ তৈরি করা হয়নি</strong>
            <span>উপরের &apos;এআই ডাক্তার ব্রিফ তৈরি করুন&apos; বোতামে চাপ দিলে বর্তমান সব তথ্য গুছিয়ে রিপোর্ট তৈরি হবে।</span>
          </div>
        )}
      </div>

      <div className="two-col-grid">
        {/* 1. Clean Patient & Caregiver Profile */}
        <div className="card">
          <h2 className="section-heading">আম্মুজি ও পরিবারের প্রোফাইল</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            পরিবারের সদস্য হিসেবে আম্মুজির প্রকৃত তথ্য ও পছন্দের ভাষা এখানে সংরক্ষণ করুন।
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
                ভাষা ও আঞ্চলিক ধরন (এআই কথা বলার ধরন)
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
                className="input-control tabular-nums"
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
                className="input-control tabular-nums"
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
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              onClick={handleSaveProfile}
            >
              প্রোফাইল সংরক্ষণ করুন
            </motion.button>
            <span className="inline-feedback" id="profile-save-msg">
              {profileMsg}
            </span>
          </div>
        </div>

        {/* 2. Accessibility & Voice Tuning */}
        <div className="card">
          <h2 className="section-heading">অ্যাক্সেসিবিলিটি ও বয়স্ক-বান্ধব কণ্ঠ</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            আম্মুজির দৃষ্টিশক্তি ও শ্রবণশক্তির সুবিধার্থে লেখার আকার, কনট্রাস্ট এবং এআই বাংলা কণ্ঠ নিয়ন্ত্রণ করুন।
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
                <motion.button
                  key={opt.val}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className={`btn btn-sm ${
                    Number(state.settings.zoom) === opt.val ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() => handleSetFontZoom(opt.val)}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="header-actions" style={{ marginBottom: 'var(--space-md)' }}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-soft btn-sm"
              id="btn-contrast-toggle"
              onClick={handleToggleContrast}
            >
              {state.settings.highContrast
                ? 'উচ্চ কনট্রাস্ট: চালু'
                : 'উচ্চ কনট্রাস্ট: বন্ধ'}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className={`btn btn-sm ${state.settings.useAiVoice ? 'btn-primary' : 'btn-outline'}`}
              onClick={handleToggleAiVoice}
            >
              {state.settings.useAiVoice
                ? 'এআই প্রাকৃতিক কণ্ঠ: চালু'
                : 'এআই প্রাকৃতিক কণ্ঠ: বন্ধ'}
            </motion.button>
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
                className="input-control tabular-nums"
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
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-outline"
              onClick={handleTestVoice}
            >
              কণ্ঠ পরীক্ষা করে শুনুন
            </motion.button>
            <span className="inline-feedback" id="voice-test-msg">
              {voiceTestMsg}
            </span>
          </div>
        </div>

        {/* 3. Caregiver Alerts & Telegram Bot Webhook Config */}
        <div className="card">
          <h2 className="section-heading">জরুরি সতর্কতা ও টেলিগ্রাম বট সেটআপ</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            রেড-ফ্ল্যাগ (টিয়ার-০) বা ২৪ ঘণ্টার সতর্কতা (টিয়ার-১) ধরা পড়লে সার্ভার প্রক্সির মাধ্যমে নিরাপদে টেলিগ্রাম অ্যালার্ট পাঠানো হবে।
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
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-outline"
              onClick={() => void handleTestTelegramPayload()}
            >
              টেলিগ্রাম সেটিংস সংরক্ষণ ও পরীক্ষা করুন
            </motion.button>
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
                    <span className="kpi-caption tabular-nums">{a.time}</span>
                  </div>
                  <div className="kpi-caption">উদ্ধৃতি: &quot;{a.quote}&quot;</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. One-Tap WhatsApp Summary Exporter & PDPA 2026 Controls */}
        <div className="card">
          <h2 className="section-heading">হোয়াটসঅ্যাপ সারসংক্ষেপ ও PDPA ২০২৬</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            কাশির ডায়েরি, ভাইটালস, ওষুধের তালিকা এবং এনটিপি টিবি/এক্স-রে চেকলিস্ট এক ক্লিকে কপি বা ডাউনলোড করে হোয়াটসঅ্যাপে পাঠান।
          </p>

          <pre className="code-preview" id="whatsapp-summary-preview">
            {summaryText}
          </pre>

          <div className="header-actions" style={{ marginTop: 'var(--space-md)' }}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              onClick={() => void handleCopyDoctorSummary(summaryText)}
            >
              হোয়াটসঅ্যাপ সারসংক্ষেপ কপি করুন
            </motion.button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              WhatsApp-এ খুলুন
            </a>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-outline"
              onClick={handleDownloadTxt}
            >
              টেক্সট ডাউনলোড (.txt)
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-soft btn-sm"
              onClick={handleDownloadJson}
            >
              JSON ব্যাকআপ
            </motion.button>
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
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-emergency btn-sm"
              id="btn-erase-all"
              onClick={handleEraseClick}
            >
              {eraseArmed
                ? 'নিশ্চিত করতে আরেকবার চাপুন (সব মুছে যাবে)'
                : 'সব তথ্য মুছে ফেলুন (PDPA ২০২৬)'}
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Settings;
