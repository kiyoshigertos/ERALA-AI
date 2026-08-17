import React from "react";
import {
  Sparkles,
  Mic,
  Settings,
  Globe,
  Sun,
  Moon,
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Heart,
  Brain,
  Zap,
  Bot,
} from "lucide-react";
import { LanguageCode, PersonaMode, UserPreferences } from "../types";

interface HeaderProps {
  prefs: UserPreferences;
  onUpdatePrefs: (prefs: UserPreferences) => void;
  onOpenVoiceMode: () => void;
  onOpenSettings: () => void;
  deviceView: "responsive" | "mobile" | "tablet" | "desktop";
  onChangeDeviceView: (view: "responsive" | "mobile" | "tablet" | "desktop") => void;
  onToggleSidebar?: () => void;
}

const LANGUAGES: Array<{ code: LanguageCode; label: string; flag: string }> = [
  { code: "english", label: "English (US)", flag: "🇺🇸" },
  { code: "auto", label: "Auto Detect (Any Language)", flag: "🌐" },
  { code: "filipino", label: "Filipino (Tagalog)", flag: "🇵🇭" },
  { code: "taglish", label: "Taglish (Filipino-English)", flag: "🇵🇭" },
  { code: "cebuano", label: "Cebuano (Bisaya)", flag: "🇵🇭" },
  { code: "ilocano", label: "Ilocano", flag: "🇵🇭" },
  { code: "spanish", label: "Español (Spanish)", flag: "🇪🇸" },
  { code: "japanese", label: "日本語 (Japanese)", flag: "🇯🇵" },
  { code: "french", label: "Français (French)", flag: "🇫🇷" },
  { code: "german", label: "Deutsch (German)", flag: "🇩🇪" },
  { code: "chinese", label: "中文 (Chinese)", flag: "🇨🇳" },
];

const PERSONAS: Array<{ mode: PersonaMode; label: string; icon: any; color: string }> = [
  { mode: "balanced", label: "Everyday Partner", icon: Bot, color: "text-cyan-400" },
  { mode: "companion", label: "EQ Companion", icon: Heart, color: "text-rose-400" },
  { mode: "analyst", label: "Deep Analyst", icon: Brain, color: "text-purple-400" },
  { mode: "productivity", label: "Productivity", icon: Zap, color: "text-amber-400" },
];

export const Header: React.FC<HeaderProps> = ({
  prefs,
  onUpdatePrefs,
  onOpenVoiceMode,
  onOpenSettings,
  deviceView,
  onChangeDeviceView,
  onToggleSidebar,
}) => {
  const currentLang = LANGUAGES.find((l) => l.code === prefs.language) || LANGUAGES[0];
  const currentPersona = PERSONAS.find((p) => p.mode === prefs.persona) || PERSONAS[0];
  const PersonaIcon = currentPersona.icon;

  const toggleTheme = () => {
    const nextTheme = prefs.theme === "dark" ? "light" : "dark";
    onUpdatePrefs({ ...prefs, theme: nextTheme });
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Toggle Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                ELARA
              </h1>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 hidden sm:inline-block">
                AI 3.7
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[280px]" title="Enhance Learning Analyst and Reasoning Assistant">
              Enhance Learning Analyst and Reasoning Assistant
            </p>
          </div>
        </div>
      </div>

      {/* Middle Controls (Device Simulation Selector & Persona Switcher) */}
      <div className="hidden lg:flex items-center gap-2">
        {/* Device Viewport Preview Selector */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onChangeDeviceView("responsive")}
            title="Auto Responsive"
            className={`p-1.5 rounded text-xs transition-colors ${
              deviceView === "responsive"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeDeviceView("mobile")}
            title="Mobile Screen View"
            className={`p-1.5 rounded text-xs transition-colors ${
              deviceView === "mobile"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeDeviceView("tablet")}
            title="Tablet Screen View"
            className={`p-1.5 rounded text-xs transition-colors ${
              deviceView === "tablet"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeDeviceView("desktop")}
            title="Desktop PC View"
            className={`p-1.5 rounded text-xs transition-colors ${
              deviceView === "desktop"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Persona Mode Switcher */}
        <div className="relative group">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:border-slate-700 transition-colors"
          >
            <PersonaIcon className={`w-3.5 h-3.5 ${currentPersona.color}`} />
            <span>{currentPersona.label}</span>
          </button>
          <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1.5 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1">
            <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
              Assistant Persona
            </div>
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.mode}
                  onClick={() => onUpdatePrefs({ ...prefs, persona: p.mode })}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                    prefs.persona === p.mode
                      ? "bg-indigo-600/30 text-indigo-300 font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Action Tools */}
      <div className="flex items-center gap-2">
        {/* Language Selector */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 hover:border-slate-700 transition-colors">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-sm">{currentLang.flag}</span>
            <span className="hidden sm:inline-block max-w-[80px] truncate">{currentLang.label.split(" ")[0]}</span>
          </button>
          <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1.5 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 max-h-80 overflow-y-auto">
            <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
              Language / Multilingual
            </div>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => onUpdatePrefs({ ...prefs, language: l.code })}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  prefs.language === l.code
                    ? "bg-cyan-600/30 text-cyan-300 font-semibold"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </div>
                {prefs.language === l.code && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Live Voice Orb Launcher */}
        <button
          onClick={onOpenVoiceMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all active:scale-95"
        >
          <Mic className="w-3.5 h-3.5 animate-pulse" />
          <span className="hidden xs:inline">Voice Mode</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title={prefs.theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {prefs.theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-300" />}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Assistant Settings & Customization"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
