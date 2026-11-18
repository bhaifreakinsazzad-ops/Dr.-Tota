import React from 'react';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  emergencyScript: string;
}

const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose, emergencyScript }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-red-900/95 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-4 border-red-500">
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">🚨</div>
          <h2 className="text-2xl font-bold text-red-700">জরুরি সতর্কতা</h2>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-900 text-base leading-relaxed font-medium">
            {emergencyScript}
          </p>
        </div>

        <div className="space-y-3 mb-4">
          <a
            href="tel:999"
            className="block w-full py-3 bg-red-600 hover:bg-red-700 text-white text-center rounded-xl font-bold text-lg transition-colors"
          >
            📞 এখনই ৯৯৯ কল করুন
          </a>
          <a
            href="tel:16263"
            className="block w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-center rounded-xl font-bold text-lg transition-colors"
          >
            📞 ১৬২৬৩ শাস্থ্য বাতায়ন
          </a>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-sm text-gray-600 text-center">
            🚫 দয়া করে শান্ত হয়ে বসুন। হাঁটাচলা করবেন না।
            <br />পাশের কাউকে ডাকুন।
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
        >
          বন্ধ করুন
        </button>
      </div>
    </div>
  );
};

export default EmergencyModal;
