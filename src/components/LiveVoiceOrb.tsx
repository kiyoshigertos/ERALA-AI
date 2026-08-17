import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  RefreshCw,
  Globe,
  Radio,
} from "lucide-react";
import { UserPreferences } from "../types";
import {
  sounds,
  createSpeechRecognizer,
  speakWithBrowser,
  stopAllSpeech,
} from "../utils/audio";

interface LiveVoiceOrbProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  onTranscriptReceived?: (transcript: string, response: string) => void;
}

type OrbState = "idle" | "listening" | "thinking" | "speaking";

export const LiveVoiceOrb: React.FC<LiveVoiceOrbProps> = ({
  isOpen,
  onClose,
  prefs,
  onTranscriptReceived,
}) => {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ speaker: "user" | "elara"; text: string }>
  >([]);

  const recognizerRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      startListeningLoop();
    } else {
      stopListeningLoop();
    }
    return () => {
      stopListeningLoop();
    };
  }, [isOpen]);

  const startListeningLoop = () => {
    stopAllSpeech();
    sounds.playChime("listening");
    setOrbState("listening");
    isListeningRef.current = true;

    const recognizer = createSpeechRecognizer(
      prefs.language,
      (result) => {
        setLiveTranscript(result.transcript);
        if (result.isFinal && result.transcript.trim().length > 2) {
          processVoiceInput(result.transcript.trim());
        }
      },
      (err) => {
        console.warn("Live voice recognition error:", err);
      },
      () => {
        if (isListeningRef.current && orbState === "listening") {
          try {
            recognizerRef.current?.start();
          } catch (e) {}
        }
      }
    );

    if (recognizer.supported) {
      recognizerRef.current = recognizer;
      recognizer.start();
    } else {
      alert("Speech recognition is not supported in this browser environment. You can use typed voice simulation.");
    }
  };

  const stopListeningLoop = () => {
    isListeningRef.current = false;
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    stopAllSpeech();
    setOrbState("idle");
  };

  // Process User Voice Input
  const processVoiceInput = async (spokenText: string) => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    setOrbState("thinking");
    setConversationHistory((prev) => [...prev, { speaker: "user", text: spokenText }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: spokenText,
          language: prefs.language,
          persona: prefs.persona,
        }),
      });

      const data = await res.json();
      const answer = data.text || "I understand. How else can I assist you today?";
      setLastResponse(answer);
      setConversationHistory((prev) => [...prev, { speaker: "elara", text: answer }]);

      if (onTranscriptReceived) {
        onTranscriptReceived(spokenText, answer);
      }

      // Voice Response
      if (!isMuted) {
        setOrbState("speaking");
        try {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: answer,
              voiceName: prefs.ttsVoiceName,
            }),
          });
          const ttsData = await ttsRes.json();
          if (ttsData.success && ttsData.audioBase64) {
            await sounds.playPcmBase64(ttsData.audioBase64, 24000);
            restartListening();
          } else {
            speakWithBrowser(answer, {
              lang: prefs.language,
              rate: prefs.speechRate,
              onEnd: () => restartListening(),
            });
          }
        } catch (e) {
          speakWithBrowser(answer, {
            lang: prefs.language,
            rate: prefs.speechRate,
            onEnd: () => restartListening(),
          });
        }
      } else {
        setOrbState("idle");
      }
    } catch (err) {
      console.error("Voice processing failed:", err);
      setOrbState("idle");
    }
  };

  const restartListening = () => {
    if (isOpen) {
      setLiveTranscript("");
      setOrbState("listening");
      isListeningRef.current = true;
      try {
        recognizerRef.current?.start();
      } catch (e) {}
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-between p-6 sm:p-10 animate-in fade-in select-none">
      {/* Top Controls */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>ELARA Live Voice AI</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline-block">
            {prefs.language.toUpperCase()} • {prefs.ttsVoiceName} Voice
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2.5 rounded-xl border transition-colors ${
              isMuted
                ? "bg-rose-950/80 border-rose-800 text-rose-300"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
            }`}
            title={isMuted ? "Unmute Speech" : "Mute Speech"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close Voice Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Glowing Fluid Neural Orb */}
      <div className="relative flex flex-col items-center justify-center my-auto space-y-8">
        <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80">
          {/* Animated Glow Rings */}
          <div
            className={`absolute rounded-full transition-all duration-700 ease-in-out ${
              orbState === "listening"
                ? "w-60 h-60 sm:w-72 sm:h-72 bg-gradient-to-tr from-cyan-500/30 via-indigo-500/30 to-purple-500/30 animate-pulse shadow-[0_0_80px_rgba(6,182,212,0.4)]"
                : orbState === "thinking"
                ? "w-56 h-56 sm:w-68 sm:h-68 bg-gradient-to-tr from-purple-500/40 via-indigo-600/40 to-pink-500/40 animate-spin shadow-[0_0_90px_rgba(168,85,247,0.5)]"
                : orbState === "speaking"
                ? "w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-tr from-emerald-500/30 via-cyan-500/30 to-indigo-500/30 shadow-[0_0_100px_rgba(16,185,129,0.5)]"
                : "w-48 h-48 sm:w-60 sm:h-60 bg-indigo-950/40"
            }`}
          />

          {/* Inner Glowing Core */}
          <div
            className={`relative z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center border transition-all duration-500 shadow-2xl ${
              orbState === "listening"
                ? "bg-gradient-to-tr from-cyan-600 to-indigo-600 border-cyan-400/80 scale-105"
                : orbState === "thinking"
                ? "bg-gradient-to-tr from-purple-600 to-pink-600 border-purple-400/80 scale-100"
                : orbState === "speaking"
                ? "bg-gradient-to-tr from-emerald-600 to-cyan-600 border-emerald-400/80 scale-110"
                : "bg-slate-900 border-slate-700 scale-95"
            }`}
          >
            {orbState === "listening" && <Mic className="w-12 h-12 text-white animate-bounce" />}
            {orbState === "thinking" && <Sparkles className="w-12 h-12 text-white animate-spin" />}
            {orbState === "speaking" && <Volume2 className="w-12 h-12 text-white animate-pulse" />}
            {orbState === "idle" && <MicOff className="w-10 h-10 text-slate-500" />}
          </div>
        </div>

        {/* State Label */}
        <div className="text-center space-y-1">
          <div className="text-lg sm:text-xl font-bold tracking-tight text-white capitalize">
            {orbState === "listening" && "ELARA is listening..."}
            {orbState === "thinking" && "Processing & reasoning..."}
            {orbState === "speaking" && "ELARA is speaking..."}
            {orbState === "idle" && "Voice AI Ready"}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {orbState === "listening"
              ? "Speak naturally in English, Filipino, Taglish, or any other language..."
              : orbState === "speaking"
              ? "Listening to response. You can speak anytime to reply."
              : "Ask about your schedule, summarize notes, or talk anytime."}
          </p>
        </div>

        {/* Live Transcript Display */}
        {(liveTranscript || lastResponse) && (
          <div className="w-full max-w-lg p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-center shadow-xl animate-in fade-in">
            {liveTranscript && (
              <div className="text-sm font-semibold text-cyan-300">
                &quot;{liveTranscript}&quot;
              </div>
            )}
            {lastResponse && orbState === "speaking" && (
              <div className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                {lastResponse}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Manual Action Bar */}
      <div className="w-full max-w-md flex items-center justify-center gap-3">
        <button
          onClick={() => {
            if (orbState === "listening") {
              stopListeningLoop();
            } else {
              startListeningLoop();
            }
          }}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center gap-2"
        >
          {orbState === "listening" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{orbState === "listening" ? "Pause Listening" : "Tap to Speak"}</span>
        </button>

        <button
          onClick={onClose}
          className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs"
        >
          Exit Live Mode
        </button>
      </div>
    </div>
  );
};
