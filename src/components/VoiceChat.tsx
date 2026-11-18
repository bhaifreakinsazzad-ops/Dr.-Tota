import React, { useState, useRef, useEffect, useCallback } from 'react';
import { speakText, SpeechRecognizer } from '../utils/speech';
import { evaluateSafetyGate } from '../utils/safetyEngine';
import { getChatHistory, addChatMessage, getProfile, getSettings, type ChatMessage } from '../utils/storage';
import { sendEmergencyTelegram } from '../utils/alerts';

interface VoiceChatProps {
  onEmergency: (script: string) => void;
}

// Dr. Tota's response engine (rule-based, no LLM)
function generateResponse(userInput: string, profile: { preferredAddress: string; name: string }): string {
  const address = profile.preferredAddress || 'মা';
  const input = userInput.toLowerCase();

  // Symptom-based responses
  if (/রাতে.*কাশি|শুলে.*কাশি|শুয়ে.*কাশি/i.test(input)) {
    return `আপনি বলছেন রাতে শুলে কাশি বাড়ে। এটা লক্ষ করলাম। এটা রিফ্লাক্স বা হার্টের কারণেও হতে পারে। শুয়ে থাকলে বালিশ একটু উঁচু করে রাখুন। ডাক্তারকে এটা জানান।`;
  }
  if (/প্রেশার.*ওষুধ|rip|rami|neopril|lipril|ace/i.test(input)) {
    return `আপনার প্রেশারের ওষুধে কাশি হতে পারে। কিছু প্রেশারের ওষুধে (ACE Inhibitor) শুকনো কাশি হয়। নিজে থেকে বন্ধ করবেন না। ডাক্তারকে বলুন বিকল্প ওষুধ আছে কিনা।`;
  }
  if (/বুকে.*জ্বালা|জ্বালাপোড়া|গ্যাস|অ্যাসিডিটি/i.test(input)) {
    return `বুকে জ্বালাপোড়া হচ্ছে বুঝতে পারছি। এটা গ্যাস্ট্রিক রিফ্লাক্সের কারণে কাশি হতে পারে। খাবার পরপরই শুবেন না। ডাক্তারকে জানান।`;
  }
  if (/ক্লান্ত|মন খারাপ|দুর্বল|শরীর.*কথা.*শোনে/i.test(input)) {
    return `${address}, আপনার ক্লান্তি ও মন খারাপের কথাটা মনে রাখলাম। শরীরে কষ্ট হলে পরিবারের কাউকে জানান। পর্যাপ্ত বিশ্রাম নিন। পানি পান করুন।`;
  }
  if (/রক্ত|blood/i.test(input)) {
    return `শুনুন, এটা খুব জরুরি। কাশির সাথে রক্ত এলে এখনই ডাক্তারের কাছে যান। আমি জরুরি বার্তা পাঠিয়েছি।`;
  }
  if (/শুকনো কাশি|dry cough/i.test(input)) {
    return `শুকনো কাশির কথা বলছেন। শুকনো কাশির অনেক কারণ থাকতে পারে — ওষুধ, অ্যালার্জি, বা রিফ্লাক্স। ডাক্তার পরীক্ষা করে নিশ্চিত হতে পারবেন। গরম পানি চুমুক দিয়ে খান।`;
  }
  if (/শাঁই শাঁই|wheez|বুকে.*শব্দ/i.test(input)) {
    return `বুকে শাঁই শাঁই শব্দ হচ্ছে বুঝলাম। এটা শ্বাসনালীর সমস্যা হতে পারে। ধোঁয়া বা মশার কয়েল থেকে দূরে থাকুন। ডাক্তারকে জানান।`;
  }
  if (/পা ফোলা|edema|ফোলা/i.test(input)) {
    return `পা ফোলার কথা বলছেন। এটা হার্ট বা কিডনির কারণে হতে পারে। ডাক্তারকে দ্রুত জানান। পা উঁচুতে রাখুন।`;
  }
  if (/টেস্ট|পরীক্ষা|check/i.test(input)) {
    return `ডাক্তার আপনার জন্য কিছু পরীক্ষা দিতে পারেন — বুকের এক্সরে, রক্ত পরীক্ষা, বা কফ পরীক্ষা। উপজেলা স্বাস্থ্য কমপ্লেক্সে অনেক পরীক্ষা বিনামূল্যে হয়।`;
  }
  if (/ভালো|ঠিক আছি|সুস্থ/i.test(input)) {
    return `আলহামদুলিল্লাহ, ভালো শুনে খুশি হলাম ${address}! আজ সারাদিন কেমন কাটলো? কাশি কেমন ছিল?`;
  }
  if (/নমস্কার|সালাম|আসসালামু|হ্যালো|হাই/i.test(input)) {
    return `ওয়ালাইকুমুস সালাম ${address}! আমি ডাঃ তোতা — তবে মনে রাখবেন, আমি কিন্তু আসল ডাক্তার নই, একটি কম্পিউটার প্রোগ্রাম। আজ আপনার শরীরটা কেমন লাগছে?`;
  }

  // Default empathetic response
  return `${address}, আপনার কথাটা আমি মন দিয়ে শুনলাম। এটা মনে রাখলাম। আরেকটু বিস্তারিত বলবেন? যেমন — কাশি কখন বেশি হয়, কতদিন ধরে হচ্ছে?`;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onEmergency }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const profile = getProfile();
  const settings = getSettings();

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    // Load initial messages
    const history = getChatHistory();
    if (history.length === 0) {
      const greeting: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        text: `আসসালামু আলাইকুম ${profile.preferredAddress || 'মা'}। আমি ডাঃ তোতা — তবে মনে রাখবেন, আমি কিন্তু আসল ডাক্তার নই, একটি কম্পিউটার প্রোগ্রাম। আজ আপনার কাশি আর শরীরটা কেমন লাগছে?`,
        timestamp: new Date().toISOString(),
      };
      setMessages([greeting]);
      addChatMessage(greeting);
    } else {
      setMessages(history);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processInput = useCallback((text: string) => {
    if (!text.trim()) return;

    // Safety gate check
    const safetyResult = evaluateSafetyGate(text);
    if (safetyResult.isEmergency) {
      const emergencyMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'system',
        text: safetyResult.emergencyScriptBn,
        timestamp: new Date().toISOString(),
        isEmergency: true,
      };
      setMessages(prev => [...prev, emergencyMsg]);
      addChatMessage(emergencyMsg);
      onEmergency(safetyResult.emergencyScriptBn);
      speakText(safetyResult.emergencyScriptBn, settings.speechRate, settings.purdahMode);

      // Send emergency alert
      const s = getSettings();
      if (s.telegramToken && s.telegramChatId) {
        sendEmergencyTelegram(s.telegramToken, s.telegramChatId, text);
      }
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    addChatMessage(userMsg);

    // Generate response
    const response = generateResponse(text, profile);
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: response,
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      setMessages(prev => [...prev, assistantMsg]);
      addChatMessage(assistantMsg);
      if (settings.autoReadAloud) {
        setIsSpeaking(true);
        speakText(response, settings.speechRate, settings.purdahMode);
        setTimeout(() => setIsSpeaking(false), response.length * 80);
      }
    }, 500);
  }, [profile, settings, onEmergency]);

  const handleSend = () => {
    if (inputText.trim()) {
      processInput(inputText);
      setInputText('');
    }
  };

  const handleVoiceStart = () => {
    if (!recognizerRef.current) return;
    setInterimText('');
    recognizerRef.current.start({
      onResult: (transcript) => {
        setInterimText(transcript);
        setInputText(transcript);
      },
      onError: (err) => {
        console.error(err);
        setIsListening(false);
        setInterimText('');
      },
      onEnd: () => {
        setIsListening(false);
        if (inputText.trim()) {
          processInput(inputText);
          setInputText('');
        }
        setInterimText('');
      },
      onStart: () => {
        setIsListening(true);
      },
    });
  };

  const handleVoiceStop = () => {
    recognizerRef.current?.stop();
    setIsListening(false);
  };

  const handleRepeat = (text: string) => {
    speakText(text, settings.speechRate, settings.purdahMode);
  };

  const handleSimplify = (msg: ChatMessage) => {
    const simplified = `আপনি বলছেন: ${msg.text.substring(0, 50)}...। এটা নিয়ে ডাক্তারের সাথে কথা বলুন। আমি আপনার কথা মনে রাখছি।`;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      text: simplified,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);
    addChatMessage(newMsg);
    if (settings.autoReadAloud) {
      speakText(simplified, settings.speechRate * 0.9, settings.purdahMode);
    }
  };

  const quickPrompts = [
    { emoji: '🌙', text: 'রাতে শুলে কাশি বাড়ে' },
    { emoji: '💊', text: 'প্রেশারের ওষুধে কি কাশি হচ্ছে?' },
    { emoji: '🔥', text: 'শুকনো কাশি ও বুকে জ্বালা' },
    { emoji: '💚', text: 'ক্লান্ত ও মন খারাপ লাগছে' },
    { emoji: '🩸', text: 'জরুরি: কাশির সাথে রক্ত' },
  ];

  const coughWeeks = profile.coughWeeks;
  const showNTPBanner = coughWeeks >= 2;

  return (
    <div className="flex flex-col h-full">
      {/* NTP Tuberculosis Alert Banner */}
      {showNTPBanner && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-amber-900 font-bold text-sm">
                জাতীয় যক্ষ্মা নিয়ন্ত্রণ কর্মসূচি (NTP) সতর্কতা
              </p>
              <p className="text-amber-800 text-xs mt-1">
                কাশি ২ সপ্তাহের বেশি চলছে। বিনামূল্যে কফ পরীক্ষা (GeneXpert) ও বুকের এক্সরে করান।
                নিকটস্থ উপজেলা স্বাস্থ্য কমপ্লেক্স বা DOTS কেন্দ্রে যান।
              </p>
              <a
                href="tel:16263"
                className="inline-block mt-2 px-3 py-1 bg-amber-600 text-white rounded-full text-xs font-medium hover:bg-amber-700"
              >
                📞 ১৬২৬৩ ডাক্তার কল
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                msg.isEmergency
                  ? 'bg-red-100 border-2 border-red-400 w-full'
                  : msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : msg.role === 'system'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm">🦜</span>
                  <span className="text-xs font-medium text-gray-500">ডাঃ তোতা</span>
                </div>
              )}
              <p className={`text-sm leading-relaxed ${msg.isEmergency ? 'text-red-900 font-medium' : ''}`}>
                {msg.text}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${msg.role === 'user' ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && !msg.isEmergency && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRepeat(msg.text)}
                      className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                      title="আবার শুনুন"
                    >
                      🔁 শুনুন
                    </button>
                    <button
                      onClick={() => handleSimplify(msg)}
                      className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                      title="সহজ করে বলুন"
                    >
                      💡 সহজ
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Speech indicator */}
        {isSpeaking && (
          <div className="flex justify-center">
            <div className="flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full">
              <div className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <div className="w-1 h-4 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              <div className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <span className="text-xs text-emerald-700 ml-1">বলছি...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Symptom Chips */}
      <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-gray-100">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => processInput(prompt.text)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium transition-colors"
          >
            {prompt.emoji} {prompt.text}
          </button>
        ))}
      </div>

      {/* Voice Orb + Text Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        {/* Interim transcript */}
        {interimText && (
          <div className="mb-2 text-center">
            <span className="text-sm text-gray-500 italic">"{interimText}"</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Voice Orb */}
          <button
            onClick={isListening ? handleVoiceStop : handleVoiceStart}
            className={`relative flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? 'bg-red-500 animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {isListening ? (
              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
            ) : null}
            <span className="text-2xl text-white z-10">
              {isListening ? '⏹️' : '🎙️'}
            </span>
          </button>

          {/* Text Input */}
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="এখানে লিখুন অথবা মাইকে বলুন..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-colors"
            >
              পাঠান
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;
