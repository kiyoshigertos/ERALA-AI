import React from "react";
import {
  MessageSquare,
  Calendar,
  FileScan,
  Heart,
  Image as ImageIcon,
  Mic,
  Settings,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ActiveTab, ScheduleItem } from "../types";

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  scheduleItems: ScheduleItem[];
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  scheduleItems,
  isOpenMobile,
  onCloseMobile,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const pendingTodayCount = scheduleItems.filter(
    (item) => item.date === todayStr && !item.completed
  ).length;

  const NAV_ITEMS: Array<{
    id: ActiveTab;
    label: string;
    sublabel: string;
    icon: any;
    badge?: number;
    color: string;
    description: string;
  }> = [
    {
      id: "chat",
      label: "Chat & Reasoning",
      sublabel: "Multimodal AI & Problem Solving",
      icon: MessageSquare,
      color: "text-cyan-400 group-hover:text-cyan-300",
      description: "Gemini 3.7 Intelligence, Multimodal, Universal Q&A",
    },
    {
      id: "schedule",
      label: "Schedule & Reminders",
      sublabel: "Smart Agenda & Calendar Export",
      icon: Calendar,
      badge: pendingTodayCount > 0 ? pendingTodayCount : undefined,
      color: "text-amber-400 group-hover:text-amber-300",
      description: "Smart agenda, reminders, and calendar export",
    },
    {
      id: "scanner",
      label: "Document Scanner",
      sublabel: "OCR, Summaries & Translation",
      icon: FileScan,
      color: "text-emerald-400 group-hover:text-emerald-300",
      description: "OCR, Summary, Reviewer analysis & Translation",
    },
    {
      id: "companion",
      label: "EQ & Wellness",
      sublabel: "Empathetic Support & Breathing",
      icon: Heart,
      color: "text-rose-400 group-hover:text-rose-300",
      description: "Empathetic companion, mood tracker & breathing",
    },
    {
      id: "images",
      label: "AI Image Studio",
      sublabel: "Generative Art & Visual Concepts",
      icon: ImageIcon,
      color: "text-purple-400 group-hover:text-purple-300",
      description: "Generative art, styles, and prompt refinement",
    },
    {
      id: "live-voice",
      label: "Live Voice AI",
      sublabel: "Real-time Spoken Conversation",
      icon: Mic,
      color: "text-indigo-400 group-hover:text-indigo-300",
      description: "Real-time speech conversation with voice orb",
    },
    {
      id: "settings",
      label: "Settings & Profile",
      sublabel: "Voices, Languages & Backups",
      icon: Settings,
      color: "text-slate-400 group-hover:text-slate-200",
      description: "Voices, language preferences, and data backup",
    },
  ];

  const handleTabClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
        />
      )}

      {/* Desktop & Mobile Drawer */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-slate-950/95 md:bg-slate-950/50 border-r border-slate-800/80
          flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out
          ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="space-y-6">
          {/* Mobile Header in Drawer */}
          <div className="flex items-center justify-between md:hidden pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="font-bold text-base text-white">ELARA Navigation</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1">
              Modules & Capabilities
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all group relative
                    ${
                      isActive
                        ? "bg-slate-800/90 text-white shadow-md border border-slate-700/60 font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-slate-950 text-cyan-400 shadow-inner"
                          : "bg-slate-900/80 " + item.color
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm leading-tight flex items-center gap-1.5">
                        <span className={isActive ? "text-white font-semibold" : ""}>{item.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors block leading-tight mt-0.5">
                        {item.sublabel}
                      </span>
                    </div>
                  </div>

                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-cyan-400 to-indigo-500 rounded-r" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Status & Companion Card */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800/90 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Today's Agenda
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Online
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {pendingTodayCount > 0 ? (
                <span>
                  You have <strong className="text-amber-400">{pendingTodayCount}</strong> pending{" "}
                  {pendingTodayCount === 1 ? "task" : "tasks"} scheduled for today.
                </span>
              ) : (
                <span className="text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All scheduled tasks for today are completed!
                </span>
              )}
            </p>
          </div>

          <div className="text-[10px] text-slate-400 text-center leading-tight">
            <span className="font-semibold text-slate-300">ELARA</span> • Enhance Learning Analyst and Reasoning Assistant
          </div>
        </div>
      </aside>
    </>
  );
};
