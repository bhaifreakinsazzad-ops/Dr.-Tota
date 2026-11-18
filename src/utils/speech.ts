// Web Speech API Utilities for Dr. Tota

export function speakText(text: string, rate: number = 0.88, purdahMode: boolean = false): void {
  if (purdahMode) return;
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'bn-BD';
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a Bengali female voice
  const voices = window.speechSynthesis.getVoices();
  const bnVoice = voices.find(v =>
    (v.lang.startsWith('bn') || v.lang.startsWith('hi')) && v.name.toLowerCase().includes('female')
  ) || voices.find(v => v.lang.startsWith('bn'))
    || voices.find(v => v.lang.startsWith('hi'));

  if (bnVoice) {
    utterance.voice = bnVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export type SpeechRecognitionCallback = {
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart: () => void;
};

export class SpeechRecognizer {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'bn-BD';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  start(callbacks: SpeechRecognitionCallback): void {
    if (!this.recognition) {
      callbacks.onError("আপনার ব্রাউজারে ভয়েস রিকগনিশন সাপোর্ট নেই। Chrome ব্যবহার করুন।");
      return;
    }

    this.isListening = true;
    callbacks.onStart();

    let finalTranscript = '';

    this.recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        callbacks.onResult(finalTranscript);
      } else if (interim) {
        callbacks.onResult(interim);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      callbacks.onError(`ভয়েস ত্রুটি: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      callbacks.onError("মাইক্রোফোন শুরু করা যায়নি। অনুমতি দিন।");
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}
