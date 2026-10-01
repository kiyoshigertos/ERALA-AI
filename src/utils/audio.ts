// Web Audio API Utilities for ELARA (PCM audio playback, microphone analyzer, sound chimes, and Speech Recognition)

class SoundEffects {
  private ctx: AudioContext | null = null;
  private currentPcmSource: AudioBufferSourceNode | null = null;

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playChime(type: "reminder" | "complete" | "listening" | "success" | "gentle" | "beep") {
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

          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.4);
        });
      } else if (type === "reminder") {
        // Gentle bell chime
        [880, 1318.51].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.12);

          gain.gain.setValueAtTime(0.18, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.7);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.75);
        });
      } else if (type === "listening") {
        // Futuristic gentle high blip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "beep") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(700, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else {
        // Gentle warm tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(528, now); // Solfeggio 528Hz

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.85);
      }
    } catch (e) {
      console.warn("AudioContext chime failed:", e);
    }
  }

  // Play PCM 24kHz audio from Gemini TTS with clean interrupt capability
  async playPcmBase64(base64Pcm: string, sampleRate = 24000): Promise<void> {
    this.stopCurrentPcm();

    return new Promise(async (resolve, reject) => {
      try {
        const ctx = this.getContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const binaryString = atob(base64Pcm);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 16-bit PCM little-endian conversion
        const numSamples = Math.floor(len / 2);
        const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const float32Array = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
          const int16 = dataView.getInt16(i * 2, true); // little-endian
          float32Array[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
        }

        const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
        audioBuffer.copyToChannel(float32Array, 0, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        this.currentPcmSource = source;

        source.onended = () => {
          if (this.currentPcmSource === source) {
            this.currentPcmSource = null;
          }
          resolve();
        };

        source.start();
      } catch (err) {
        console.error("Failed to decode and play PCM audio:", err);
        reject(err);
      }
    });
  }

  stopCurrentPcm() {
    if (this.currentPcmSource) {
      try {
        this.currentPcmSource.stop();
        this.currentPcmSource.disconnect();
      } catch (e) {}
      this.currentPcmSource = null;
    }
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

  let recognition: any = null;
  let isRunning = false;

  const targetLang =
    lang === "filipino" || lang === "taglish" || lang === "cebuano" || lang === "ilocano"
      ? "fil-PH"
      : lang === "spanish"
      ? "es-ES"
      : lang === "japanese"
      ? "ja-JP"
      : lang === "french"
      ? "fr-FR"
      : lang === "german"
      ? "de-DE"
      : lang === "chinese"
      ? "zh-CN"
      : "en-US";

  try {
    recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = targetLang;

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
      const text = (final || interim).trim();
      if (text) {
        onResult({
          transcript: text,
          isFinal: !!final,
        });
      }
    };

    recognition.onerror = (event: any) => {
      // Benign errors like 'no-speech' or 'aborted' are common in continuous recognition
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition notice:", event.error);
        if (onError) onError(event);
      }
    };

    recognition.onend = () => {
      isRunning = false;
      if (onEnd) onEnd();
    };
  } catch (err) {
    console.warn("Failed to instantiate SpeechRecognition:", err);
    return {
      supported: false,
      start: () => {},
      stop: () => {},
    };
  }

  return {
    supported: true,
    start: () => {
      if (recognition && !isRunning) {
        try {
          recognition.start();
          isRunning = true;
        } catch (e) {
          // Ignore if already active
        }
      }
    },
    stop: () => {
      if (recognition && isRunning) {
        try {
          recognition.stop();
          isRunning = false;
        } catch (e) {}
      }
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
    voiceName?: string;
    onEnd?: () => void;
  }
): { stop: () => void } {
  if (!("speechSynthesis" in window)) {
    if (options?.onEnd) options.onEnd();
    return { stop: () => {} };
  }

  window.speechSynthesis.cancel();
  const clean = text
    .replace(/[*#_`~\[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .slice(0, 450);

  if (!clean.trim()) {
    if (options?.onEnd) options.onEnd();
    return { stop: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  const preferredLang =
    options?.lang === "filipino" || options?.lang === "taglish" || options?.lang === "cebuano"
      ? "fil-PH"
      : options?.lang === "spanish"
      ? "es-ES"
      : options?.lang === "japanese"
      ? "ja-JP"
      : "en-US";

  utterance.lang = preferredLang;
  utterance.rate = Math.max(0.7, Math.min(1.4, options?.rate || 1.0));
  utterance.pitch = Math.max(0.7, Math.min(1.3, options?.pitch || 1.0));

  // Voice matching
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith(preferredLang.toLowerCase().slice(0, 2))) ||
      voices.find((v) => v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Siri")) ||
      voices[0];
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  let ended = false;
  const finish = () => {
    if (!ended) {
      ended = true;
      if (options?.onEnd) options.onEnd();
    }
  };

  utterance.onend = finish;
  utterance.onerror = (err) => {
    console.warn("Speech synthesis error:", err);
    finish();
  };

  window.speechSynthesis.speak(utterance);

  return {
    stop: () => {
      window.speechSynthesis.cancel();
      finish();
    },
  };
}

export function stopAllSpeech() {
  sounds.stopCurrentPcm();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Microphone Level Analyzer Hook / Utility for Real-time Waveforms
export function createMicrophoneVisualizer(
  stream: MediaStream,
  onVolumeUpdate: (volume: number, freqData: number[]) => void
): { stop: () => void } {
  let isRunning = true;
  let animId: number | null = null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const checkVolume = () => {
    if (!isRunning) return;
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    const freqBars: number[] = [];
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
      if (i < 16) {
        freqBars.push(Math.round((dataArray[i] / 255) * 100));
      }
    }
    const avg = Math.min(100, Math.round((sum / dataArray.length / 255) * 100 * 2.2));
    onVolumeUpdate(avg, freqBars);

    animId = requestAnimationFrame(checkVolume);
  };

  checkVolume();

  return {
    stop: () => {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
      try {
        source.disconnect();
        analyser.disconnect();
        ctx.close();
      } catch (e) {}
    },
  };
}

