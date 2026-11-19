// Speech & Audio Utilities for Dr. Tota
// Combines Gemini AI Bangla TTS + Web Speech fallback, and Web Speech STT + universal MediaRecorder AI transcription

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onAudioLevel?: (level: number) => void;
}

let activeAudio: HTMLAudioElement | null = null;
let activeSpeakRequestId = 0;
let sharedAudioCtx: AudioContext | null = null;
let activeMeterCancel: (() => void) | null = null;

function stopAudioLevelMeter(): void {
  if (activeMeterCancel) {
    activeMeterCancel();
    activeMeterCancel = null;
  }
}

function attachAudioLevelMeter(
  audio: HTMLAudioElement,
  onAudioLevel?: (level: number) => void
): void {
  stopAudioLevelMeter();
  if (!onAudioLevel || typeof window === 'undefined') return;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }

    const source = sharedAudioCtx.createMediaElementSource(audio);
    const analyser = sharedAudioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;

    source.connect(analyser);
    analyser.connect(sharedAudioCtx.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;
    let stopped = false;

    const sample = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const normalized = Math.min(1, rms * 3.8);
      onAudioLevel(normalized);
      rafId = requestAnimationFrame(sample);
    };

    rafId = requestAnimationFrame(sample);

    activeMeterCancel = () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // ignore disconnect errors
      }
      onAudioLevel(0);
    };
  } catch {
    // Graceful fallback: audio still plays even if Web Audio capture is restricted
  }
}

function speakWithBrowserSynthesis(
  text: string,
  rate: number,
  forceEmergency: boolean,
  callbacks?: SpeakCallbacks
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
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

export async function speakText(
  text: string,
  rate: number = 0.88,
  purdahMode: boolean = false,
  forceEmergency: boolean = false,
  callbacks?: SpeakCallbacks,
  useAiVoice: boolean = true
): Promise<void> {
  if ((purdahMode && !forceEmergency) || typeof window === 'undefined') {
    callbacks?.onEnd?.();
    return;
  }

  stopSpeaking();
  const requestId = ++activeSpeakRequestId;

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (useAiVoice && online) {
    try {
      callbacks?.onStart?.();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, urgent: forceEmergency }),
      });

      if (requestId !== activeSpeakRequestId) return;

      if (res.ok) {
        const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
        if (data.audioBase64) {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
          audio.playbackRate = forceEmergency ? 0.95 : Math.max(0.75, Math.min(1.2, rate || 0.88));
          activeAudio = audio;
          attachAudioLevelMeter(audio, callbacks?.onAudioLevel);
          audio.onended = () => {
            if (activeAudio === audio) activeAudio = null;
            stopAudioLevelMeter();
            callbacks?.onEnd?.();
          };
          audio.onerror = () => {
            if (activeAudio === audio) activeAudio = null;
            stopAudioLevelMeter();
            speakWithBrowserSynthesis(text, rate, forceEmergency, callbacks);
          };
          await audio.play();
          return;
        }
      }
    } catch {
      if (requestId !== activeSpeakRequestId) return;
      stopAudioLevelMeter();
      // Fall through cleanly to browser Web Speech synthesis
    }
  }

  if (requestId !== activeSpeakRequestId) return;
  speakWithBrowserSynthesis(text, rate, forceEmergency, callbacks);
}

export function stopSpeaking(): void {
  activeSpeakRequestId++;
  stopAudioLevelMeter();
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
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
      callbacks.onError('এই ব্রাউজারে সরাসরি মাইক্রোফোন সমর্থিত নয় — এআই ভয়েস রেকর্ড বোতাম বা লেখার বক্স ব্যবহার করুন।');
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
      }, 650);
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

export class UniversalAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('এই ব্রাউজারে অডিও রেকর্ডিং সমর্থিত নয়।');
    }
    stopSpeaking();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: preferredMime });
    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };
    this.mediaRecorder.start(250);
  }

  async stopAndEncode(): Promise<{ audioBase64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('রেকর্ডিং চালু ছিল না।'));
        return;
      }
      const recorder = this.mediaRecorder;
      const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];

      recorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = String(reader.result || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            this.cleanup();
            resolve({ audioBase64: base64, mimeType });
          };
          reader.onerror = () => {
            this.cleanup();
            reject(new Error('অডিও ফাইল প্রক্রিয়াকরণে সমস্যা হয়েছে।'));
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      recorder.stop();
    });
  }

  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
