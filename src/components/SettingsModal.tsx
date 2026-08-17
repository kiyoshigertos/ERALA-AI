import React from "react";
import {
  Settings,
  X,
  Globe,
  Bot,
  Volume2,
  Brain,
  Bell,
  Trash2,
  Download,
  RotateCcw,
  Check,
} from "lucide-react";
import { UserPreferences, LanguageCode, PersonaMode } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  onSavePrefs: (prefs: UserPreferences) => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prefs,
  onSavePrefs,
  onResetAllData,
}) => {
  if (!isOpen) return null;

  const handleExportData = () => {
    const backup = {
      messages: localStorage.getItem("elara_chat_messages_v1"),
      schedule: localStorage.getItem("elara_schedule_items_v1"),
      scannedDocs: localStorage.getItem("elara_scanned_docs_v1"),
      moodHistory: localStorage.getItem("elara_mood_history_v1"),
      images: localStorage.getItem("elara_images_v1"),
      prefs,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ELARA_Assistant_Backup_${Date.now()}.json`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-white">
              ELARA Settings & Preferences
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* User Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              User Name / Preferred Name
            </label>
            <input
              type="text"
              value={prefs.userName}
              onChange={(e) => onSavePrefs({ ...prefs, userName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>

          {/* Primary Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Primary Language</span>
            </label>
            <select
              value={prefs.language}
              onChange={(e) =>
                onSavePrefs({ ...prefs, language: e.target.value as LanguageCode })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="english">English (US - Default)</option>
              <option value="taglish">Taglish (Metro Manila Filipino-English)</option>
              <option value="filipino">Filipino (Formal Tagalog)</option>
              <option value="cebuano">Cebuano (Bisaya)</option>
              <option value="ilocano">Ilocano</option>
              <option value="spanish">Español</option>
              <option value="japanese">日本語 (Japanese)</option>
              <option value="auto">Auto-detect user input language</option>
            </select>
          </div>

          {/* Persona Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>Default Persona / Assistant Behavior</span>
            </label>
            <select
              value={prefs.persona}
              onChange={(e) =>
                onSavePrefs({ ...prefs, persona: e.target.value as PersonaMode })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="balanced">Everyday Partner (Intelligent, warm, all-around)</option>
              <option value="companion">EQ Companion (Empathetic, compassionate, caring)</option>
              <option value="analyst">Deep Analyst (Rigorous logic, structured, formal)</option>
              <option value="productivity">Productivity Coach (Action-oriented, efficient)</option>
            </select>
          </div>

          {/* TTS Voice Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice AI Model & Timbre</span>
            </label>
            <select
              value={prefs.ttsVoiceName}
              onChange={(e: any) =>
                onSavePrefs({ ...prefs, ttsVoiceName: e.target.value })
              }
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="Kore">Kore (Warm, Calm & Natural Female Voice)</option>
              <option value="Puck">Puck (Friendly & Lively Voice)</option>
              <option value="Zephyr">Zephyr (Soft, Gentle & Soothing Voice)</option>
              <option value="Fenrir">Fenrir (Deep & Resonant Male Voice)</option>
              <option value="Charon">Charon (Authoritative & Crisp Voice)</option>
            </select>
          </div>

          {/* Deep Reasoning Default */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>Deep Reasoning by Default</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Engage Gemini 2.5 thinking budget for higher cognitive problem solving.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.deepReasoningDefault}
              onChange={(e) =>
                onSavePrefs({ ...prefs, deepReasoningDefault: e.target.checked })
              }
              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {/* Notification Sounds */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Sound Chimes & Completion Tones</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Play subtle auditory feedback when actions complete or reminders trigger.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.notificationSound}
              onChange={(e) =>
                onSavePrefs({ ...prefs, notificationSound: e.target.checked })
              }
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>

          {/* Data Management */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Data & Storage
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Backup (JSON)</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Are you sure you want to reset all data and history?")) {
                    onResetAllData();
                    onClose();
                  }
                }}
                className="py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-xs font-semibold text-rose-300 border border-rose-800/80 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset All Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
