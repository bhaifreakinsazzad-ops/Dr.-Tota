import React, { useState, useEffect } from 'react';
import { Info, Shield, Phone, WifiOff } from 'lucide-react';

interface HeaderProps {
  purdahMode: boolean;
  syncStatus: string;
  onTogglePurdah: () => void;
  onEmergency: () => void;
}

const Header: React.FC<HeaderProps> = ({ purdahMode, syncStatus, onTogglePurdah, onEmergency }) => {
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
    <header className="app-header">
      <div className="app-header-main">
        <div className="brand-block">
          <div className="brand-title-row">
            <h1 className="brand-title">ডাঃ তোতা</h1>
            <span className="disclaimer-pill" id="header-disclaimer">
              <Info size={18} aria-hidden="true" />
              ডক্টর টোটা একটি এআই স্বাস্থ্য সহায়ক, আসল ডাক্তার নন
            </span>
          </div>
          <p className="lede" id="header-subtitle">
            আম্মুজির কাশি পর্যবেক্ষণ, ওষুধ যাচাই এবং পরিবার সমন্বয় সহায়ক
          </p>
        </div>

        <div className="header-actions">
          <span
            className="sync-chip"
            id="sync-status-pill"
            role="status"
            aria-live="polite"
            data-offline={!isOnline ? 'true' : 'false'}
          >
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isOnline ? 'bg-[#2e7d4f]' : 'bg-[#b86e00] animate-pulse'
              }`}
              aria-hidden="true"
            />
            {isOnline ? syncStatus : 'অফলাইন সেশন'}
          </span>

          <button
            type="button"
            className="btn btn-soft btn-sm"
            id="btn-purdah"
            onClick={onTogglePurdah}
            aria-pressed={purdahMode}
          >
            <Shield size={18} aria-hidden="true" />
            <span id="purdah-btn-label">
              {purdahMode ? 'নিরিবিলি মোড: চালু' : 'নিরিবিলি মোড: বন্ধ'}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-emergency"
            id="btn-emergency-top"
            onClick={onEmergency}
          >
            <Phone size={20} aria-hidden="true" />
            জরুরি: ৯৯৯ / ১৬২৬৩
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="offline-banner" role="status" aria-live="polite">
          <WifiOff size={18} aria-hidden="true" className="shrink-0 text-[#b86e00]" />
          <span>
            আপনি এখন অফলাইনে আছেন — ইন্টারনেট না থাকায় ভয়েস সেবা (ভয়েস ইনপুট ও অডিও) সীমিত হতে পারে। স্থানীয় ডায়েরি ও তথ্য সংরক্ষণ চালু আছে।
          </span>
        </div>
      )}
    </header>
  );
};

export default Header;
