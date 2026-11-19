import React, { useState, useEffect } from 'react';

interface HeaderProps {
  purdahMode: boolean;
  onTogglePurdah: () => void;
  onEmergency: () => void;
}

const Header: React.FC<HeaderProps> = ({ purdahMode, onTogglePurdah, onEmergency }) => {
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
    <header className="relative z-50 bg-gradient-to-r from-emerald-700 to-teal-600 text-white shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦜</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">ডাঃ তোতা (Dr. Tota)</h1>
              <p className="text-xs text-emerald-100 leading-tight">
                একটি এআই স্বাস্থ্য সহকারী • আসল ডাক্তার নয়
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePurdah}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                purdahMode
                  ? 'bg-yellow-400 text-yellow-900'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="নিরিবিলি মোড - অডিও বন্ধ"
            >
              {purdahMode ? '🔇 নিরিবিলি' : '🔊 নিরিবিলি'}
            </button>
            <button
              onClick={onEmergency}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold animate-pulse shadow-lg"
            >
              🚨 জরুরি ৯৯৯
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-emerald-100">
          <span>{isOnline ? '☁️ ক্লাউড সংরক্ষিত' : '💾 স্থানীয়ভাবে সংরক্ষিত'}</span>
          <span>•</span>
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 font-medium"
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 bg-green-300 rounded-full inline-block"></span>
                <span>অনলাইন • প্রস্তুত</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-amber-300 rounded-full inline-block animate-pulse"></span>
                <span className="text-amber-200">অফলাইন</span>
              </>
            )}
          </span>
        </div>
      </div>

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-400 text-amber-950 border-t border-amber-300 px-4 py-1.5"
        >
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs font-semibold">
            <span aria-hidden="true">📵</span>
            <span>
              আপনি এখন অফলাইনে আছেন — ইন্টারনেট না থাকায় ভয়েস সেবা (ভয়েস ইনপুট ও অডিও) সীমিত হতে পারে।
            </span>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
