import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, RotateCcw, Plus, Minus, CheckCircle2, Pause } from 'lucide-react';

interface BreathRateTimerProps {
  onRecordBreathRate: (bpm: number, durationSeconds: number, rawBreaths: number) => void;
}

const TOTAL_SECONDS = 60;

const BreathRateTimer: React.FC<BreathRateTimerProps> = ({ onRecordBreathRate }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_SECONDS);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [breathCount, setBreathCount] = useState<number>(0);
  const [hasSavedRun, setHasSavedRun] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const breathCountRef = useRef<number>(0);
  breathCountRef.current = breathCount;

  const hasSavedRunRef = useRef<boolean>(false);
  hasSavedRunRef.current = hasSavedRun;

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          const finalBreaths = breathCountRef.current;
          if (finalBreaths > 0 && !hasSavedRunRef.current) {
            hasSavedRunRef.current = true;
            setHasSavedRun(true);
            onRecordBreathRate(finalBreaths, TOTAL_SECONDS, finalBreaths);
            setFeedback(
              `৬০ সেকেন্ড সম্পন্ন! প্রতি মিনিটে ${finalBreaths} বার শ্বাস-প্রশ্বাস কাশির ইতিহাসে সংরক্ষিত হয়েছে।`
            );
          } else if (finalBreaths === 0) {
            setFeedback('৬০ সেকেন্ড শেষ হয়েছে, কিন্তু কোনো শ্বাস গণনা করা হয়নি। আবার চেষ্টা করুন।');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onRecordBreathRate]);

  const elapsedSeconds = TOTAL_SECONDS - secondsLeft;
  const estimatedBpm =
    secondsLeft === 0
      ? breathCount
      : elapsedSeconds > 0
      ? Math.round((breathCount / elapsedSeconds) * 60)
      : 0;

  const handleStartTimer = () => {
    if (secondsLeft === 0 || hasSavedRun) {
      setSecondsLeft(TOTAL_SECONDS);
      setBreathCount(0);
      setHasSavedRun(false);
    }
    setFeedback('');
    setIsRunning(true);
  };

  const handlePauseTimer = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(TOTAL_SECONDS);
    setBreathCount(0);
    setHasSavedRun(false);
    setFeedback('');
  };

  const handleIncrementBreath = () => {
    if (!isRunning && secondsLeft === TOTAL_SECONDS) {
      // Auto-start 60s timer on first tap if user taps counter directly
      setIsRunning(true);
      setHasSavedRun(false);
      setFeedback('');
    }
    if (secondsLeft === 0) return;
    setBreathCount((prev) => prev + 1);
  };

  const handleDecrementBreath = () => {
    if (secondsLeft === 0) return;
    setBreathCount((prev) => Math.max(0, prev - 1));
  };

  const handleManualSave = () => {
    if (breathCount <= 0 || hasSavedRun) return;
    const duration = elapsedSeconds > 0 ? elapsedSeconds : TOTAL_SECONDS;
    const bpm = secondsLeft === 0 ? breathCount : Math.round((breathCount / duration) * 60);
    setIsRunning(false);
    setHasSavedRun(true);
    onRecordBreathRate(bpm, duration, breathCount);
    setFeedback(
      `শ্বাস-প্রশ্বাসের হার (${bpm} বার/মিনিট) কাশির ইতিহাসে সংরক্ষিত হয়েছে।`
    );
  };

  const getRateAssessment = (bpm: number) => {
    if (bpm === 0) return { label: 'পরিমাপ অপেক্ষমাণ', status: 'info' };
    if (bpm >= 25) return { label: `দ্রুত শ্বাস (${bpm}/মি.) — ডাক্তারের পরামর্শ নিন`, status: 'alert' };
    if (bpm >= 21) return { label: `সামান্য বেশি (${bpm}/মি.) — পর্যবেক্ষণ করুন`, status: 'warn' };
    if (bpm < 12) return { label: `ধীর শ্বাস (${bpm}/মি.) — পর্যবেক্ষণ করুন`, status: 'warn' };
    return { label: `স্বাভাবিক সীমা (${bpm}/মি.)`, status: 'ok' };
  };

  const displayBpm = secondsLeft === 0 ? breathCount : estimatedBpm;
  const assessment = getRateAssessment(displayBpm);
  const progressPercent = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100;

  return (
    <div className="card" id="breath-rate-timer-card">
      <div className="brand-title-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
        <div className="flex items-center gap-2">
          <Timer size={22} className="text-[#0f7c8a]" aria-hidden="true" />
          <h2 className="section-heading" style={{ margin: 0 }}>
            শ্বাস-প্রশ্বাসের হার টাইমার (৬০ সেকেন্ড)
          </h2>
        </div>
        <span className="chip" data-status={assessment.status}>
          {assessment.label}
        </span>
      </div>

      <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
        আম্মুজি শান্ত অবস্থায় থাকার সময় ৬০ সেকেন্ডের টাইমার চালু করুন এবং প্রতিটি শ্বাস নেওয়ার সাথে নিচের বোতামে চাপ দিন। সময় শেষে ফলাফল স্বয়ংক্রিয়ভাবে কাশির ইতিহাসে যুক্ত হবে।
      </p>

      {/* Timer & Counter Display */}
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="status-card" data-status={isRunning ? 'warn' : 'info'}>
          <div className="kpi-label">অবশিষ্ট সময়</div>
          <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {secondsLeft} সেকেন্ড
          </div>
          <div className="w-full h-2 bg-[#e3f1f3] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-[#0f7c8a] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="status-card" data-status={breathCount > 0 ? 'ok' : 'info'}>
          <div className="kpi-label">গণনাকৃত শ্বাস</div>
          <div className="kpi-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {breathCount} বার
          </div>
          <div className="kpi-caption">
            {secondsLeft === 0
              ? `চূড়ান্ত হার: ${breathCount} বার/মিনিট`
              : elapsedSeconds > 0
              ? `আনুমানিক হার: ${estimatedBpm} বার/মিনিট`
              : 'প্রতি শ্বাস নেওয়ায় +১ চাপুন'}
          </div>
        </div>
      </div>

      {/* Primary Breath Tap Button + Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary flex-1 min-h-[60px]"
            onClick={handleIncrementBreath}
            disabled={secondsLeft === 0}
          >
            <Plus size={22} aria-hidden="true" />
            <span>১টি শ্বাস গণনা করুন ({breathCount})</span>
          </button>

          <button
            type="button"
            className="btn btn-outline min-h-[60px]"
            onClick={handleDecrementBreath}
            disabled={breathCount === 0 || secondsLeft === 0}
            title="১ কম করুন"
            aria-label="গণনা ১ কম করুন"
          >
            <Minus size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="header-actions" style={{ justifyContent: 'space-between' }}>
          <div className="header-actions">
            {!isRunning ? (
              <button type="button" className="btn btn-soft btn-sm" onClick={handleStartTimer}>
                <Play size={16} aria-hidden="true" />
                <span>
                  {secondsLeft < TOTAL_SECONDS && secondsLeft > 0
                    ? 'টাইমার চালিয়ে যান'
                    : '৬০ সেকেন্ড টাইমার শুরু করুন'}
                </span>
              </button>
            ) : (
              <button type="button" className="btn btn-soft btn-sm" onClick={handlePauseTimer}>
                <Pause size={16} aria-hidden="true" />
                <span>বিরতি</span>
              </button>
            )}

            <button type="button" className="btn btn-outline btn-sm" onClick={handleReset}>
              <RotateCcw size={16} aria-hidden="true" />
              <span>রিসেট</span>
            </button>
          </div>

          {breathCount > 0 && !hasSavedRun && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleManualSave}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>ইতিহাসে সংরক্ষণ করুন</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="inline-feedback" style={{ marginTop: 'var(--space-sm)' }} role="status">
          {feedback}
        </div>
      )}
    </div>
  );
};

export default BreathRateTimer;
