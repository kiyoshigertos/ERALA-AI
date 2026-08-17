// Web Audio API Utilities for ELARA (PCM audio playback, microphone analyzer, sound chimes, and Speech Recognition)

class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playChime(type: "reminder" | "complete" | "listening" | "success" | "gentle") {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      if (type === "complete" || type === "success") {
        // Joyful chord: C5 -> E5 -> G5 -> C6
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.08);

          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.45);
        });
      } else if (type === "reminder") {
        // Gentle bell chime: two harmonic pings
        [880, 1318.51].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.12);

          gain.gain.setValueAtTime(0.2, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.85);
        });
      } else if (type === "listening") {
        // Soft rising futuristic blip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        // Gentle warm tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(528, now); // Solfeggio 528Hz love/peace frequency

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.95);
      }
    } catch (e) {
      console.warn("AudioContext chime failed:", e);
    }
  }

  // Play PCM 24kHz audio from Gemini TTS
  async playPcmBase64(base64Pcm: string, sampleRate = 24000): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const ctx = this.getContext();
        const binaryString = atob(base64Pcm);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 16-bit PCM little endian
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.copyToChannel(float32Array, 0, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      } catch (err) {
        console.error("Failed to decode and play PCM audio:", err);
        reject(err);
      }
    });
  }
}

export const sounds = new SoundEffects();

// Browser Speech Recognition Wrapper
export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export function createSpeechRecognizer(
  lang: string = "fil-PH",
  onResult: (payload: SpeechRecognitionResultPayload) => void,
  onError?: (err: any) => void,
  onEnd?: () => void
) {
  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return {
      supported: false,
      start: () => {},
      stop: () => {},
    };
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang === "filipino" || lang === "taglish" ? "fil-PH" : lang === "cebuano" ? "fil-PH" : lang === "english" ? "en-US" : lang;

  recognition.onresult = (event: any) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    onResult({
      transcript: (final || interim).trim(),
      isFinal: !!final,
    });
  };

  recognition.onerror = (event: any) => {
    console.warn("Speech recognition notice:", event.error);
    if (onError) onError(event);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return {
    supported: true,
    start: () => {
      try {
        recognition.start();
      } catch (e) {
        // already started
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch (e) {}
    },
  };
}

// Browser Web Speech Synthesis Fallback
export function speakWithBrowser(
  text: string,
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    onEnd?: () => void;
  }
) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#_`~\[\]]/g, "").slice(0, 400);
  const utterance = new SpeechSynthesisUtterance(clean);

  const preferredLang = options?.lang === "filipino" || options?.lang === "taglish" ? "fil-PH" : "en-US";
  utterance.lang = preferredLang;
  utterance.rate = options?.rate || 1.0;
  utterance.pitch = options?.pitch || 1.0;

  // Try to find natural sounding voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(
    (v) => v.lang.startsWith("fil") || v.lang.startsWith("tl") || v.name.includes("Google") || v.name.includes("Natural")
  );
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopAllSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
