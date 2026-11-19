import React, { useState, useEffect } from 'react';
import { Shield, Phone, WifiOff, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  purdahMode: boolean;
  syncStatus: string;
  motherLabel: string;
  onTogglePurdah: () => void;
  onEmergency: () => void;
}

const Header: React.FC<HeaderProps> = ({
  purdahMode,
  syncStatus,
  motherLabel,
  onTogglePurdah,
  onEmergency,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <motion.header
      className="app-header"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="app-header-main">
        {/* Zone 1: Brand Crest & Clean Clinical Metadata */}
        <div className="flex items-center gap-3.5">
          <div className="brand-mark-badge" aria-hidden="true">
            <Stethoscope size={24} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="brand-title-row">
              <h1 className="brand-title">ডাঃ তোতা</h1>
              <span className="status-text" data-status="info">
                · {motherLabel}-র এআই স্বাস্থ্য কনসোল
              </span>
            </div>
            <div className="meta-line">
              <span>এআই স্বাস্থ্য সহায়ক (আসল ডাক্তার নন)</span>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span id="sync-status-pill" role="status" aria-live="polite">
                {isOnline ? syncStatus : 'অফলাইন সেশন'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2 & 3: Privacy Toggle + Primary Emergency CTA */}
        <div className="header-actions">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            className={`btn btn-sm ${purdahMode ? 'btn-primary' : 'btn-soft'}`}
            id="btn-purdah"
            onClick={onTogglePurdah}
            aria-pressed={purdahMode}
          >
            <Shield size={18} aria-hidden="true" />
            <span id="purdah-btn-label">
              {purdahMode ? 'নিরিবিলি মোড: চালু' : 'নিরিবিলি মোড: বন্ধ'}
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-emergency"
            id="btn-emergency-top"
            onClick={onEmergency}
          >
            <Phone size={20} aria-hidden="true" />
            জরুরি: ৯৯৯ / ১৬২৬৩
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            className="offline-banner"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <WifiOff size={18} aria-hidden="true" className="shrink-0 text-[#b86e00]" />
            <span>
              আপনি এখন অফলাইনে আছেন — ইন্টারনেট না থাকায় এআই বিশ্লেষণ সীমিত হতে পারে। স্থানীয় ডায়েরি ও জরুরি নিরাপত্তা চালু আছে।
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;
