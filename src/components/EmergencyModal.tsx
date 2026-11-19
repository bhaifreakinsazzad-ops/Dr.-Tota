import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EMERGENCY_SCRIPT_BN } from '../utils/safetyEngine';
import { copyTextToClipboard } from '../utils/alerts';
import { stopSpeaking } from '../utils/speech';

interface EmergencyModalProps {
  isOpen: boolean;
  reason: string;
  motherLabel: string;
  onClose: () => void;
}

const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  reason,
  motherLabel,
  onClose,
}) => {
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCopyFeedback('');
    }
  }, [isOpen]);

  const reasonText =
    reason === 'manual'
      ? 'শনাক্তকৃত কারণ: সরাসরি জরুরি বোতাম চাপ হয়েছে'
      : `শনাক্তকৃত জরুরি লক্ষণ: ${reason}`;

  const handleCopyDispatch = async () => {
    const msg = `[জরুরি সতর্কতা - ডাঃ তোতা] ${motherLabel || 'আম্মুজি'}-এর সম্ভাব্য জরুরি লক্ষণ দেখা দিয়েছে (${reasonText})। অবিলম্বে ৯৯৯ বা নিকটস্থ হাসপাতালে যোগাযোগ করুন।`;
    const ok = await copyTextToClipboard(msg);
    setCopyFeedback(
      ok
        ? 'জরুরি বার্তা কপি হয়েছে — পরিবারের হোয়াটসঅ্যাপে পেস্ট করে পাঠান'
        : 'কপি করা যায়নি — অনুগ্রহ করে সরাসরি ৯৯৯ নম্বরে কল করুন'
    );
  };

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          id="emergency-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-dialog"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
              <h2
                className="section-heading"
                id="emergency-modal-title"
                style={{ color: 'var(--error)', margin: 0 }}
              >
                জরুরি চিকিৎসাসহায়তা প্রোটোকল (টিয়ার-০)
              </h2>
              <span className="status-text" data-status="alert">
                তাৎক্ষণিক পদক্ষেপ
              </span>
            </div>

            <div className="status-card" data-status="alert">
              <p className="msg-body" style={{ fontWeight: 700, color: 'var(--on-surface)' }}>
                {EMERGENCY_SCRIPT_BN}
              </p>
            </div>

            <p className="lede">{reasonText}</p>

            <div className="two-col-grid" style={{ gap: 'var(--space-sm)' }}>
              <motion.a
                whileTap={{ scale: 0.98 }}
                href="tel:999"
                className="btn btn-emergency"
                style={{ textAlign: 'center' }}
              >
                জাতীয় জরুরি সেবা: ৯৯৯
              </motion.a>
              <motion.a
                whileTap={{ scale: 0.98 }}
                href="tel:16263"
                className="btn btn-primary"
                style={{ textAlign: 'center' }}
              >
                স্বাস্থ্য বাতায়ন (২৪/৭ ডাক্তার): ১৬২৬৩
              </motion.a>
            </div>

            <div className="callout-info">
              <strong>তাৎক্ষণিক নিরাপদ করণীয়:</strong>
              <ul style={{ margin: 'var(--space-xs) 0 0 0', paddingLeft: 'var(--space-lg)' }}>
                <li>সোজা হয়ে বসুন বা আধা-শোয়া অবস্থায় আরাম করে থাকুন (জোর করে হাঁটবেন না)।</li>
                <li>একা থাকলে ঘরের দরজার ছিটকিনি খুলে রাখুন যাতে সাহায্য দ্রুত ঢুকতে পারে।</li>
                <li>সম্ভব হলে পাশের বিশ্বস্ত কাউকে বা দায়িত্বপ্রাপ্ত পরিবারের সদস্যকে ডাকুন।</li>
              </ul>
            </div>

            <div className="header-actions" style={{ justifyContent: 'space-between' }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                className="btn btn-outline"
                onClick={handleCopyDispatch}
              >
                জরুরি বার্তা কপি করে পরিবারকে পাঠান
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                className="btn btn-soft"
                onClick={handleClose}
              >
                আমি নিরাপদ আছি / বন্ধ করুন
              </motion.button>
            </div>

            {copyFeedback && <span className="inline-feedback">{copyFeedback}</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmergencyModal;
