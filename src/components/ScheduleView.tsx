import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Download,
  Filter,
  Sparkles,
  AlertCircle,
  Tag,
  Search,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { ScheduleItem } from "../types";
import { sounds } from "../utils/audio";
import { downloadIcsFile } from "../utils/ics";

interface ScheduleViewProps {
  items: ScheduleItem[];
  onAddItem: (item: Omit<ScheduleItem, "id" | "createdAt" | "completed">) => void;
  onToggleComplete: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  study: { bg: "bg-blue-950/60", text: "text-blue-300", border: "border-blue-800/60" },
  work: { bg: "bg-purple-950/60", text: "text-purple-300", border: "border-purple-800/60" },
  health: { bg: "bg-emerald-950/60", text: "text-emerald-300", border: "border-emerald-800/60" },
  personal: { bg: "bg-cyan-950/60", text: "text-cyan-300", border: "border-cyan-800/60" },
  errands: { bg: "bg-amber-950/60", text: "text-amber-300", border: "border-amber-800/60" },
};

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-rose-950/80 text-rose-300 border-rose-800" },
  high: { label: "High", color: "bg-amber-950/80 text-amber-300 border-amber-800" },
  normal: { label: "Normal", color: "bg-slate-800 text-slate-300 border-slate-700" },
  relaxed: { label: "Relaxed", color: "bg-emerald-950/80 text-emerald-300 border-emerald-800" },
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  items,
  onAddItem,
  onToggleComplete,
  onDeleteItem,
}) => {
  const [naturalInput, setNaturalInput] = useState("");
  const [isParsingNatural, setIsParsingNatural] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "today" | "upcoming" | "completed">("today");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form State for Manual Add Modal
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("10:00");
  const [category, setCategory] = useState<"work" | "personal" | "study" | "health" | "errands">("study");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "relaxed">("normal");
  const [notes, setNotes] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  // Natural Language AI Parsing
  const handleNaturalAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalInput.trim() || isParsingNatural) return;

    setIsParsingNatural(true);
    try {
      const res = await fetch("/api/parse-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: naturalInput }),
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        data.items.forEach((parsed: any) => {
          onAddItem({
            title: parsed.title || naturalInput,
            date: parsed.date || todayStr,
            time: parsed.time || "10:00",
            category: parsed.category || "personal",
            priority: parsed.priority || "normal",
            notes: parsed.notes || `Added via natural language: "${naturalInput}"`,
            reminderMinutesBefore: parsed.reminderMinutesBefore || 15,
          });
        });

        setNaturalInput("");
        sounds.playChime("complete");
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.warn("Failed to parse natural language schedule:", err);
      // Fallback: add directly
      onAddItem({
        title: naturalInput,
        date: todayStr,
        time: "10:00",
        category: "personal",
        priority: "normal",
        notes: "",
      });
      setNaturalInput("");
    } finally {
      setIsParsingNatural(false);
    }
  };

  // Manual Add Form Submit
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddItem({
      title: title.trim(),
      date,
      time,
      category,
      priority,
      notes: notes.trim(),
      reminderMinutesBefore: 15,
    });

    setTitle("");
    setNotes("");
    setIsModalOpen(false);
    sounds.playChime("complete");
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
  };

  const handleToggle = (id: string, currentlyCompleted: boolean) => {
    onToggleComplete(id);
    if (!currentlyCompleted) {
      sounds.playChime("complete");
      confetti({ particleCount: 45, spread: 70, origin: { y: 0.7 } });
    }
  };

  // Filtering
  const filteredItems = items.filter((item) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Category
    if (categoryFilter !== "all" && item.category !== categoryFilter) {
      return false;
    }

    // Tab Filter
    if (activeFilter === "today") {
      return item.date === todayStr && !item.completed;
    } else if (activeFilter === "upcoming") {
      return item.date > todayStr && !item.completed;
    } else if (activeFilter === "completed") {
      return item.completed;
    }
    return true;
  });

  const todayCount = items.filter((i) => i.date === todayStr && !i.completed).length;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner & Fast AI Input */}
      <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Schedule & Agenda
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Intelligent scheduler with natural language understanding across any language.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadIcsFile(items)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              title="Export schedule to Apple/Google/Outlook Calendar (.ics)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Calendar (.ics)</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event / Task</span>
            </button>
          </div>
        </div>

        {/* Natural Language Quick Input Bar */}
        <form onSubmit={handleNaturalAdd} className="relative">
          <div className="flex items-center bg-slate-950/90 border border-slate-800 focus-within:border-amber-500/80 rounded-2xl p-1.5 shadow-inner">
            <div className="p-2 text-amber-400">
              <Sparkles className={`w-4 h-4 ${isParsingNatural ? "animate-spin" : ""}`} />
            </div>
            <input
              type="text"
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
              placeholder="Natural AI Scheduler (e.g. 'Study Physics tomorrow at 2pm' or 'Dentist appointment on Friday 10am')..."
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none px-2"
            />
            <button
              type="submit"
              disabled={!naturalInput.trim() || isParsingNatural}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                !naturalInput.trim() || isParsingNatural
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95"
              }`}
            >
              {isParsingNatural ? "Parsing..." : "AI Schedule"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter Tabs & Search */}
      <div className="px-4 sm:px-6 py-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveFilter("today")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeFilter === "today"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Today {todayCount > 0 && `(${todayCount})`}
          </button>
          <button
            onClick={() => setActiveFilter("upcoming")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeFilter === "upcoming"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeFilter === "all"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setActiveFilter("completed")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              activeFilter === "completed"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Completed
          </button>
        </div>

        {/* Category & Search Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 outline-none w-32 sm:w-44 focus:border-amber-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="study">Study</option>
            <option value="work">Work</option>
            <option value="health">Health</option>
            <option value="personal">Personal</option>
            <option value="errands">Errands</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Calendar className="w-6 h-6 text-slate-600" />
            </div>
            <h3 className="font-semibold text-slate-300 text-sm">No Scheduled Items Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Try typing in the natural language bar above or click &quot;Add Event / Task&quot; to add a new item.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2.5">
            {filteredItems.map((item) => {
              const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.personal;
              const priorityInfo = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;
              const isDueToday = item.date === todayStr;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                    item.completed
                      ? "bg-slate-950/40 border-slate-900 opacity-60"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => handleToggle(item.id, item.completed)}
                      className={`mt-0.5 transition-colors ${
                        item.completed
                          ? "text-emerald-400"
                          : "text-slate-600 hover:text-amber-400"
                      }`}
                      title={item.completed ? "Mark as Incomplete" : "Mark as Done"}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-sm leading-tight ${
                            item.completed ? "line-through text-slate-500" : "text-slate-100"
                          }`}
                        >
                          {item.title}
                        </span>

                        {/* Category badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {item.category}
                        </span>

                        {/* Priority badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityInfo.color}`}
                        >
                          {priorityInfo.label}
                        </span>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                          {item.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isDueToday ? "text-amber-400" : "text-slate-400"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {item.date === todayStr ? "Ngayong Araw (Today)" : item.date}
                        </span>
                        {item.time && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Task Creator Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Add Event / Task
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Title / Task Name *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Review Research Paper, Team Meeting..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500"
                  >
                    <option value="study">Study</option>
                    <option value="work">Work</option>
                    <option value="health">Health & Wellness</option>
                    <option value="personal">Personal</option>
                    <option value="errands">Errands</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes & Details
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details, location, or notes..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
                >
                  Save to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
