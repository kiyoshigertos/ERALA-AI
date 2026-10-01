import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RotateCcw,
  Globe,
  Radio,
  Send,
  SlidersHorizontal,
  ChevronDown,
  MessageSquare,
  Zap,
  Activity,
  AlertCircle,
  Play,
  Square,
} from "lucide-react";
import { UserPreferences, LanguageCode } from "../types";
import { sounds, speakWithBrowser, stopAllSpeech } from "../utils/audio";

interface LiveVoiceOrbProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  onTranscriptReceived?: (transcript: string, response: string) => void;
}

type OrbState = "idle" | "connecting" | "live" | "speaking" | "thinking";

const AVAILABLE_VOICES: Array<{ id: UserPreferences["ttsVoiceName"]; label: string; desc: string }> = [
  { id: "Zephyr", label: "Zephyr", desc: "Calm & Natural (Recommended)" },
  { id: "Kore", label: "Kore", desc: "Warm & Caring" },
  { id: "Puck", label: "Puck", desc: "Energetic & Playful" },
  { id: "Charon", label: "Charon", desc: "Deep & Grounded" },
  { id: "Fenrir", label: "Fenrir", desc: "Crisp & Confident" },
];

const SUGGESTED_VOICE_QUERIES = [
  "What's on my agenda for today?",
  "Give me a 30-second motivation boost",
  "Help me prioritize my daily tasks",
  "Kumusta ka ELARA? Ano ang maitutulong mo?",
  "Explain quantum computing in 3 simple sentences",
];

// Helper: Convert Float32 audio samples (-1.0 to 1.0) to 16-bit PCM little-endian Base64
function float32ToPcm16Base64(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = "";
  const bytes = new Uint8Array(pcm16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 24kHz 16-bit PCM little-endian to AudioBuffer
function pcm24kBase64ToAudioBuffer(ctx: AudioContext, base64: string): AudioBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }

  const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}

export const LiveVoiceOrb: React.FC<LiveVoiceOrbProps> = ({
  isOpen,
  onClose,
  prefs,
  onTranscriptReceived,
}) => {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elaraResponseTranscript, setElaraResponseTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<UserPreferences["ttsVoiceName"]>(
    prefs.ttsVoiceName || "Zephyr"
  );
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(prefs.language || "filipino");
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [freqBars, setFreqBars] = useState<number[]>(new Array(14).fill(10));
  const [quickInput, setQuickInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [conversationHistory, setConversationHistory] = useState<
    Array<{ speaker: "user" | "elara"; text: string; time: string }>
  >([]);

  // Refs for WebSocket, AudioContexts, and scheduling
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);

  // Keep isMutedRef in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Connect/disconnect when modal opens or closes, or voice/lang changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      startLiveSession();
    } else {
      cleanupLiveSession();
    }
    return () => {
      cleanupLiveSession();
    };
  }, [isOpen, selectedVoice, selectedLang]);

  // Initialize Gemini 3.8 Live Session
  const startLiveSession = async () => {
    cleanupLiveSession();
    setOrbState("connecting");
    setErrorMessage(null);

    try {
      // 1. Setup Output AudioContext (24kHz for model output audio)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (outputAudioCtx.state === "suspended") {
        await outputAudioCtx.resume();
      }
      outputAudioCtxRef.current = outputAudioCtx;
      nextStartTimeRef.current = outputAudioCtx.currentTime;

      // 2. Setup Input AudioContext (16kHz for mic input audio)
      const inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (inputAudioCtx.state === "suspended") {
        await inputAudioCtx.resume();
      }
      inputAudioCtxRef.current = inputAudioCtx;

      // 3. Capture Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 4. Setup Analyser Node for Orb Visualizer
      const analyser = inputAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const sourceNode = inputAudioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      // Start Visualizer Loop
      startVisualizer();

      // 5. Connect WebSocket to /live
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/live?voice=${encodeURIComponent(
        selectedVoice
      )}&language=${encodeURIComponent(selectedLang)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Live Client] Connected to Gemini 3.8 Live WebSocket");
        setIsLiveConnected(true);
        setOrbState("live");
        sounds.playChime("gentle");

        // 6. Setup Audio Processor for Mic streaming
        const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        sourceNode.connect(processor);
        processor.connect(inputAudioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          if (ws.readyState !== WebSocket.OPEN) return;

          const channelData = e.inputBuffer.getChannelData(0);
          const base64Audio = float32ToPcm16Base64(channelData);

          ws.send(JSON.stringify({ audio: base64Audio }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle incoming audio chunk from Gemini 3.8 Live
          if (msg.audio) {
            setOrbState("speaking");
            playModelAudioChunk(msg.audio);
          }

          // Handle Interrupted Event
          if (msg.interrupted) {
            handleInterrupted();
          }

          // Handle Live Transcriptions
          if (msg.outputText) {
            setElaraResponseTranscript((prev) => prev + msg.outputText);
          }
          if (msg.inputText) {
            setLiveTranscript(msg.inputText);
          }

          if (msg.type === "error") {
            console.warn("[Live Client] Message notice:", msg.error);
          }
        } catch (e) {
          console.error("[Live Client] Error parsing ws message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[Live Client] WebSocket error:", err);
        setErrorMessage("Connection issue with Gemini 3.8 Live API. You can still use voice turn or quick input.");
        setOrbState("idle");
      };

      ws.onclose = () => {
        console.log("[Live Client] WebSocket closed");
        setIsLiveConnected(false);
        setOrbState("idle");
      };
    } catch (err: any) {
      console.error("[Live Client] Failed to initialize live audio session:", err);
      setOrbState("idle");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Microphone access was denied. Please allow microphone permissions or use quick input.");
      } else {
        setErrorMessage(err.message || "Failed to start live session.");
      }
    }
  };

  // Schedule Audio Chunk for gapless 24kHz playback
  const playModelAudioChunk = (base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    try {
      const buffer = pcm24kBase64ToAudioBuffer(ctx, base64Audio);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
      activeSourcesRef.current.push(source);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setOrbState("live");
        }
      };
    } catch (e) {
      console.error("[Live Client] Error decoding audio chunk:", e);
    }
  };

  // Handle Interrupted: stop active audio sources and reset schedule
  const handleInterrupted = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setOrbState("live");
  };

  // Visualizer Animation
  const startVisualizer = () => {
    const dataArray = new Uint8Array(32);

    const update = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        const bars: number[] = [];
        for (let i = 0; i < 14; i++) {
          const val = dataArray[i] || 0;
          sum += val;
          bars.push(Math.max(10, Math.min(100, Math.round((val / 255) * 100))));
        }

        const avgVolume = Math.round((sum / (14 * 255)) * 100);
        setAudioVolume(avgVolume);
        setFreqBars(bars);
      }
      animFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  // Cleanup Live Session
  const cleanupLiveSession = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    handleInterrupted();

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== "closed") {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== "closed") {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    setIsLiveConnected(false);
    setOrbState("idle");
  };

  // Send Quick Text Query into Live Session or Fallback
  const handleSendQuickInput = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query) return;

    setQuickInput("");
    setLiveTranscript(query);
    setElaraResponseTranscript("");

    // If live WebSocket is connected, send directly through Live API session!
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: query }));
      setOrbState("thinking");
      return;
    }

    // Fallback: POST to /api/voice-turn
    setOrbState("thinking");
    try {
      const res = await fetch("/api/voice-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          language: selectedLang,
          persona: prefs.persona,
          voiceName: selectedVoice,
        }),
      });

      const data = await res.json();
      if (data.success && data.responseText) {
        setElaraResponseTranscript(data.responseText);
        if (data.audioBase64 && outputAudioCtxRef.current) {
          playModelAudioChunk(data.audioBase64);
        } else {
          speakWithBrowser(data.responseText, {
            rate: prefs.speechRate || 1.0,
            voiceName: selectedVoice,
          });
        }

        if (onTranscriptReceived) {
          onTranscriptReceived(query, data.responseText);
        }
      }
    } catch (err: any) {
      console.error("Voice turn fallback error:", err);
      setErrorMessage("Could not reach voice assistant. Please check connection.");
    } finally {
      setOrbState("idle");
    }
  };

  // Replay Last Spoken Response
  const handleReplayResponse = () => {
    if (!elaraResponseTranscript) return;
    speakWithBrowser(elaraResponseTranscript, {
      rate: prefs.speechRate || 1.0,
      voiceName: selectedVoice,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                  ELARA Live Voice AI
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  gemini-3.8-live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Low-latency bidirectional audio streaming with Live API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1 ${
                showSettings
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200"
                  : "bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200"
              }`}
              title="Voice Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition-all"
              title="Close Voice Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Drawer */}
        {showSettings && (
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3 animate-in slide-in-from-top-2 duration-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Voice Name Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">AI Voice Persona</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {AVAILABLE_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} ({v.desc})
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Spoken Language</label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="english">English (Global)</option>
                  <option value="filipino">Filipino / Tagalog</option>
                  <option value="taglish">Taglish (Conversational)</option>
                  <option value="cebuano">Cebuano / Bisaya</option>
                  <option value="spanish">Spanish (Español)</option>
                  <option value="japanese">Japanese (日本語)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Orb Centerpiece */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 space-y-6 relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div
            className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              orbState === "speaking"
                ? "bg-cyan-500/25 scale-125"
                : orbState === "live"
                ? "bg-indigo-500/20 scale-100"
                : orbState === "thinking"
                ? "bg-purple-500/30 scale-110"
                : "bg-slate-800/10 scale-90"
            }`}
          />

          {/* Interactive Voice Orb */}
          <div className="relative flex items-center justify-center">
            {/* Outer Pulsing Rings */}
            <div
              className={`absolute inset-0 rounded-full border border-indigo-500/30 transition-transform duration-300 ${
                orbState === "speaking"
                  ? "scale-150 animate-ping opacity-25"
                  : orbState === "live"
                  ? "scale-125 animate-pulse opacity-20"
                  : "scale-100 opacity-0"
              }`}
            />

            {/* Glowing Core Sphere */}
            <div
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 relative cursor-pointer group ${
                orbState === "speaking"
                  ? "bg-gradient-to-tr from-cyan-600 via-indigo-500 to-fuchsia-500 shadow-cyan-500/40 scale-105"
                  : orbState === "live"
                  ? "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-indigo-500/40"
                  : orbState === "thinking"
                  ? "bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-amber-500 shadow-purple-500/40 animate-pulse"
                  : "bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-800 shadow-slate-900/40 opacity-75"
              }`}
              style={{
                transform: `scale(${1 + (audioVolume / 100) * 0.25})`,
              }}
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {/* Inner Mesh Glass Reflection */}
              <div className="absolute inset-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                {isMuted ? (
                  <MicOff className="w-10 h-10 text-rose-300 animate-pulse" />
                ) : orbState === "speaking" ? (
                  <Volume2 className="w-10 h-10 text-cyan-200 animate-bounce" />
                ) : (
                  <Mic className="w-10 h-10 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                )}
              </div>
            </div>
          </div>

          {/* Equalizer Frequency Bars */}
          <div className="flex items-center gap-1.5 h-8">
            {freqBars.map((height, idx) => (
              <div
                key={idx}
                className={`w-1 rounded-full transition-all duration-75 ${
                  orbState === "speaking"
                    ? "bg-cyan-400"
                    : isMuted
                    ? "bg-slate-700"
                    : "bg-indigo-400"
                }`}
                style={{ height: `${isMuted ? 6 : Math.max(6, height * 0.3)}px` }}
              />
            ))}
          </div>

          {/* Live Transcript Display Box */}
          <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center space-y-2 min-h-[90px] flex flex-col justify-center">
            {elaraResponseTranscript ? (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                  ELARA Speaking
                </span>
                <p className="text-sm font-medium text-slate-100 leading-relaxed line-clamp-3">
                  "{elaraResponseTranscript}"
                </p>
              </div>
            ) : liveTranscript ? (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  You Spoke
                </span>
                <p className="text-sm font-medium text-slate-200 line-clamp-3">
                  "{liveTranscript}"
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {isMuted
                  ? "Microphone is muted. Click the orb to unmute."
                  : isLiveConnected
                  ? "Listening live... Speak naturally or ask anything."
                  : "Connecting to Gemini 3.8 Live API..."}
              </p>
            )}
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="w-full max-w-md p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </span>
              <button
                onClick={startLiveSession}
                className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-semibold"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Bottom Controls & Quick Query Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 space-y-3">
          {/* Quick Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuickInput(quickInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Or type a question for ELARA's live voice..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all"
              title="Send to Live Voice"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Action Buttons & Inspiration */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`py-1.5 px-3 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                  isMuted
                    ? "bg-rose-500/20 border-rose-500 text-rose-200"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? "Unmute" : "Mute Mic"}</span>
              </button>

              {elaraResponseTranscript && (
                <button
                  type="button"
                  onClick={handleReplayResponse}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Replay Voice</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {SUGGESTED_VOICE_QUERIES.slice(0, 2).map((query, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendQuickInput(query)}
                  className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-400 hover:text-slate-200 whitespace-nowrap transition-all"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
