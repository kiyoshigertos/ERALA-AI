import React, { useState, useEffect } from "react";
import {
  Heart,
  Smile,
  Sparkles,
  Wind,
  Play,
  Square,
  Volume2,
  VolumeX,
  History,
  TrendingUp,
  Sun,
  ShieldCheck,
  Send,
  RefreshCw,
} from "lucide-react";
import confetti from "canvas-confetti";
import { MoodEntry, UserPreferences } from "../types";
import { sounds, speakWithBrowser, stopAllSpeech } from "../utils/audio";

interface CompanionViewProps {
  moodHistory: MoodEntry[];
  onSaveMoodEntry: (entry: MoodEntry) => void;
  prefs: UserPreferences;
}

const MOOD_OPTIONS = [
  { rating: 5, emoji: "✨", label: "Radiant & Energized", color: "from-amber-400 to-yellow-500" },
  { rating: 4, emoji: "😊", label: "Content & Peaceful", color: "from-emerald-400 to-teal-500" },
  { rating: 3, emoji: "😐", label: "Neutral / Balanced", color: "from-blue-400 to-cyan-500" },
  { rating: 2, emoji: "😔", label: "Tired / Drained", color: "from-indigo-400 to-purple-500" },
  { rating: 1, emoji: "🌧️", label: "Overwhelmed / Stressed", color: "from-rose-500 to-pink-600" },
];

export const CompanionView: React.FC<CompanionViewProps> = ({
  moodHistory,
  onSaveMoodEntry,
  prefs,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(4);
  const [note, setNote] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeEntry, setActiveEntry] = useState<MoodEntry | null>(
    moodHistory[0] || null
  );

  // Guided Breathing State
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Inhale");
  const [breathCount, setBreathCount] = useState(4);
  const [isPlayingQuoteAudio, setIsPlayingQuoteAudio] = useState(false);

  // Breathing Loop
  useEffect(() => {
    let interval: any = null;
    if (isBreathingActive) {
      interval = setInterval(() => {
        setBreathCount((prev) => {
          if (prev <= 1) {
            setBreathPhase((currentPhase) => {
              if (currentPhase === "Inhale") {
                sounds.playChime("gentle");
                return "Hold";
              }
              if (currentPhase === "Hold") return "Exhale";
              if (currentPhase === "Exhale") return "Rest";
              sounds.playChime("gentle");
              return "Inhale";
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreathPhase("Inhale");
      setBreathCount(4);
    }
    return () => clearInterval(interval);
  }, [isBreathingActive]);

  const handleMoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-emotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodRating: selectedRating,
          moodNote: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const parsed = data.data;
        const newEntry: MoodEntry = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          moodRating: selectedRating,
          dominantEmotion: parsed.dominantEmotion || "Balanced",
          note: note.trim(),
          empathyReflection:
            parsed.empathyReflection ||
            "Thank you for sharing. ELARA is here to listen and support you through anything you feel.",
          filipinoComfortQuote:
            parsed.filipinoComfortQuote ||
            "No matter how cloudy the day, the sky always clears and warmth returns.",
          mindfulnessExercise: parsed.mindfulnessExercise || {
            name: "Box Breathing",
            steps: [
              "Inhale deeply (4s)",
              "Hold your breath (4s)",
              "Exhale slowly and smoothly (4s)",
            ],
          },
          suggestedWellnessAction:
            parsed.suggestedWellnessAction || "Drink a glass of cold water and rest for a moment.",
          positivityScore: parsed.positivityScore || 75,
        };

        onSaveMoodEntry(newEntry);
        setActiveEntry(newEntry);
        setNote("");
        sounds.playChime("complete");
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.warn("Failed to analyze mood:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleQuoteAudio = () => {
    if (isPlayingQuoteAudio) {
      stopAllSpeech();
      setIsPlayingQuoteAudio(false);
    } else if (activeEntry) {
      setIsPlayingQuoteAudio(true);
      const textToSpeak = `${activeEntry.empathyReflection} ${activeEntry.filipinoComfortQuote}`;
      speakWithBrowser(textToSpeak, {
        lang: prefs.language,
        rate: 0.9,
        onEnd: () => setIsPlayingQuoteAudio(false),
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              EQ Companion & Mental Wellness
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Emotional intelligence, supportive reflections, mindfulness, and comforting guidance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBreathingActive(!isBreathingActive)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isBreathingActive
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>{isBreathingActive ? "Stop Breathing Exercise" : "Start Guided Breathing"}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Interactive Guided Breathing Visualizer (If Active) */}
        {isBreathingActive && (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 flex flex-col items-center justify-center space-y-4 text-center animate-in fade-in">
            <div className="text-xs uppercase font-bold tracking-widest text-indigo-300">
              Box Breathing 4-4-4-4
            </div>

            {/* Glowing Pulsing Sphere */}
            <div className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56">
              <div
                className={`absolute rounded-full transition-all duration-1000 ease-in-out ${
                  breathPhase === "Inhale"
                    ? "w-44 h-44 sm:w-52 sm:h-52 bg-gradient-to-tr from-cyan-500/40 via-indigo-500/40 to-purple-500/40 scale-100 shadow-[0_0_50px_rgba(99,102,241,0.5)]"
                    : breathPhase === "Hold"
                    ? "w-44 h-44 sm:w-52 sm:h-52 bg-gradient-to-tr from-purple-500/40 to-indigo-500/40 scale-105 shadow-[0_0_60px_rgba(168,85,247,0.5)]"
                    : breathPhase === "Exhale"
                    ? "w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-tr from-rose-500/40 to-indigo-500/40 scale-90 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
                    : "w-24 h-24 sm:w-28 sm:h-28 bg-indigo-900/30 scale-85"
                }`}
              />
              <div className="relative z-10 space-y-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {breathPhase === "Inhale"
                    ? "Inhale Deeply"
                    : breathPhase === "Hold"
                    ? "Hold Breath"
                    : breathPhase === "Exhale"
                    ? "Exhale Slowly"
                    : "Rest & Relax"}
                </div>
                <div className="text-4xl font-mono font-bold text-cyan-300">{breathCount}s</div>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-sm">
              Relax your shoulders and follow the calming rhythm of your breath.
            </p>
          </div>
        )}

        {/* Daily Mood Check-In Form */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-slate-200 flex items-center gap-2">
              <Smile className="w-4 h-4 text-rose-400" />
              How are you feeling today? (Daily Mood Check-In)
            </h3>
            <span className="text-xs text-slate-400">Select your current mood:</span>
          </div>

          {/* Mood Emoji Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {MOOD_OPTIONS.map((m) => {
              const isSelected = selectedRating === m.rating;
              return (
                <button
                  key={m.rating}
                  type="button"
                  onClick={() => setSelectedRating(m.rating)}
                  className={`p-3 rounded-2xl border transition-all text-center flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? `bg-gradient-to-b ${m.color} text-white font-bold border-transparent shadow-lg scale-105`
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">{m.emoji}</span>
                  <span className="text-[11px] leading-tight font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Note Input & Submit */}
          <form onSubmit={handleMoodSubmit} className="space-y-3 pt-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind today? (Optional: describe what you are going through or feeling)..."
              rows={2}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-rose-500 resize-none"
            />

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isAnalyzing}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  isAnalyzing
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-md shadow-rose-500/20 active:scale-95"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                <span>{isAnalyzing ? "ELARA is reflecting..." : "Reflect & Connect with ELARA"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Latest Companion Reflection Card */}
        {activeEntry && (
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-900 border border-rose-800/40 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-rose-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">
                    ELARA's Reflection & Guidance
                  </h4>
                  <span className="text-[11px] text-rose-300/80">
                    Emotion: <strong>{activeEntry.dominantEmotion}</strong> • Positivity: {activeEntry.positivityScore}%
                  </span>
                </div>
              </div>

              <button
                onClick={toggleQuoteAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs font-semibold hover:bg-rose-900 transition-colors"
              >
                {isPlayingQuoteAudio ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span>Stop Audio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Listen to Comfort Voice</span>
                  </>
                )}
              </button>
            </div>

            {/* Empathy Reflection */}
            <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-normal italic bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
              &quot;{activeEntry.empathyReflection}&quot;
            </p>

            {/* Filipino Comfort Quote */}
            {activeEntry.filipinoComfortQuote && (
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex items-start gap-3">
                <Sun className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    Uplifting Thought & Proverb
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-amber-200 mt-0.5">
                    &quot;{activeEntry.filipinoComfortQuote}&quot;
                  </p>
                </div>
              </div>
            )}

            {/* Mindfulness Exercise & Wellness Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {activeEntry.mindfulnessExercise && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5" />
                    {activeEntry.mindfulnessExercise.name}
                  </span>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {activeEntry.mindfulnessExercise.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeEntry.suggestedWellnessAction && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Suggested Wellness Step
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeEntry.suggestedWellnessAction}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mood History Timeline */}
        {moodHistory.length > 1 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              Mood History & Reflections ({moodHistory.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {moodHistory.slice(1, 7).map((entry) => {
                const opt = MOOD_OPTIONS.find((m) => m.rating === entry.moodRating) || MOOD_OPTIONS[2];
                return (
                  <div
                    key={entry.id}
                    onClick={() => setActiveEntry(entry)}
                    className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-[10px] text-slate-500">{entry.timestamp}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {entry.dominantEmotion}
                    </div>
                    {entry.note && (
                      <p className="text-[11px] text-slate-400 truncate">{entry.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
