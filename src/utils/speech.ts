// Web Speech API Utilities for Dr. Tota (with 500ms trailing silence buffer)

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

export function speakText(
  text: string,
  rate: number = 0.88,
  purdahMode: boolean = false,
  forceEmergency: boolean = false,
  callbacks?: SpeakCallbacks
): void {
  if ((purdahMode && !forceEmergency) || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'bn-BD';
  utterance.rate = forceEmergency ? 0.92 : rate || 0.88;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const bnVoice =
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('bn') && v.name.toLowerCase().includes('female')) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('bn')) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('hi'));

  if (bnVoice) {
    utterance.voice = bnVoice;
  }

  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => callbacks?.onEnd?.();
  utterance.onerror = () => callbacks?.onEnd?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export interface SpeechRecognitionCallbacks {
  onInterim: (combinedText: string) => void;
  onFinalSubmit: (finalText: string) => void;
  onError: (message: string) => void;
  onStart: () => void;
  onEnd: () => void;
}

export class SpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private finalBuffer = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'bn-BD';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  start(callbacks: SpeechRecognitionCallbacks): void {
    if (!this.recognition) {
      callbacks.onError('এই ব্রাউজারে সরাসরি মাইক্রোফোন সমর্থিত নয় — নিচের দ্রুত বোতাম বা লেখার বক্স ব্যবহার করুন।');
      return;
    }

    stopSpeaking();
    this.clearSilenceTimer();
    this.finalBuffer = '';
    this.isListening = true;
    callbacks.onStart();

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let finalized = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalized += piece + ' ';
        } else {
          interim += piece;
        }
      }
      if (finalized) {
        this.finalBuffer += finalized;
      }
      const combined = (this.finalBuffer + interim).trim();
      callbacks.onInterim(combined || 'শুনছি…');

      // 500ms trailing silence buffer so elderly users are not cut off mid-cough
      this.clearSilenceTimer();
      this.silenceTimer = setTimeout(() => {
        if (this.finalBuffer.trim().length > 0 && this.isListening) {
          this.stop(true, callbacks);
        }
      }, 500);
    };

    this.recognition.onerror = () => {
      this.stop(false, callbacks);
      callbacks.onError('শব্দ পরিষ্কার পাওয়া যায়নি — আবার চেষ্টা করুন বা নিচের বোতাম চাপুন');
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.stop(true, callbacks);
      }
    };

    try {
      this.recognition.start();
    } catch {
      this.stop(false, callbacks);
      callbacks.onError('মাইক্রোফোন শুরু করা যায়নি। অনুমতি দিন।');
    }
  }

  stop(submitBuffered: boolean = true, callbacks?: Partial<SpeechRecognitionCallbacks>): void {
    this.clearSilenceTimer();
    const wasListening = this.isListening;
    this.isListening = false;

    if (this.recognition && wasListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore already stopped
      }
    }

    const spoken = this.finalBuffer.trim();
    this.finalBuffer = '';
    if (submitBuffered && spoken.length > 0) {
      callbacks?.onFinalSubmit?.(spoken);
    }
    callbacks?.onEnd?.();
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
