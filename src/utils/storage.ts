import {
  ChatMessage,
  ScheduleItem,
  DocumentScanResult,
  MoodEntry,
  GeneratedImage,
  GeneratedVideo,
  UserPreferences,
} from "../types";

const CHAT_KEY = "elara_chat_messages_v1";
const SCHEDULE_KEY = "elara_schedule_items_v1";
const SCAN_KEY = "elara_scanned_docs_v1";
const MOOD_KEY = "elara_mood_history_v1";
const IMAGES_KEY = "elara_images_v1";
const VIDEOS_KEY = "elara_videos_v1";
const PREFS_KEY = "elara_user_prefs_v1";

const DEFAULT_PREFS: UserPreferences = {
  userName: "Friend",
  language: "english",
  persona: "balanced",
  deepReasoningDefault: false,
  voiceAutoPlay: false,
  ttsVoiceName: "Kore",
  speechRate: 1.0,
  theme: "dark",
  notificationSound: true,
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "assistant",
    content: `Hello and welcome! I am **ELARA** (*Enhance Learning Analyst and Reasoning Assistant*). 🌟

I am your personal AI assistant and companion for everyday life, studies, productivity, creativity, and mental wellness. 

**Here is what we can do together:**
1. 🗓️ **Smart Schedule & Reminders**: Tell me your tasks in natural language (e.g., *"Remind me tomorrow at 3 PM to meet the team"* or *"Mag-aral para sa exam sa Lunes"*).
2. 📄 **Document & Vision Scanner**: Upload or capture any document, receipt, notes, or reviewer for instant OCR, summaries, action items, and translation.
3. 💚 **EQ & Mindfulness Companion**: Daily mood check-ins, guided box breathing, and empathetic support whenever you need grounding.
4. 🧠 **Deep Reasoning (Gemini 3.7 Intelligence)**: Rigorous step-by-step problem solving, coding, math, and analytical research.
5. 🎙️ **Live Voice AI**: Click the Microphone or Live Voice Orb to have a natural real-time spoken conversation.
6. 🎨 **AI Image Studio**: Generate high-definition artwork, concepts, and illustrations.
7. 🌐 **Universal Multilingual Support**: Feel free to speak to me in **English**, **Filipino / Tagalog**, **Taglish**, **Cebuano**, **Spanish**, **Japanese**, or **any language** in the world!

How can I assist you today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  },
];

const INITIAL_SCHEDULE: ScheduleItem[] = [
  {
    id: "sched-1",
    title: "Review Project Summary & Notes",
    date: new Date().toISOString().split("T")[0],
    time: "14:30",
    category: "study",
    priority: "high",
    notes: "Review the scanned materials in the Document Scanner module.",
    completed: false,
    reminderMinutesBefore: 15,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sched-2",
    title: "Daily Wellness & Hydration Break",
    date: new Date().toISOString().split("T")[0],
    time: "17:00",
    category: "health",
    priority: "normal",
    notes: "Drink a glass of water, do a 60-second breathing exercise, and stretch.",
    completed: false,
    reminderMinutesBefore: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sched-3",
    title: "Weekly Planning & Groceries",
    date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    time: "10:00",
    category: "errands",
    priority: "relaxed",
    notes: "Organize upcoming week's milestones and prepare shopping list.",
    completed: false,
    reminderMinutesBefore: 30,
    createdAt: new Date().toISOString(),
  },
];

export const storage = {
  getMessages(): ChatMessage[] {
    try {
      const data = localStorage.getItem(CHAT_KEY);
      return data ? JSON.parse(data) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  },
  saveMessages(messages: ChatMessage[]) {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Storage quota or error saving messages:", e);
    }
  },

  getSchedule(): ScheduleItem[] {
    try {
      const data = localStorage.getItem(SCHEDULE_KEY);
      return data ? JSON.parse(data) : INITIAL_SCHEDULE;
    } catch {
      return INITIAL_SCHEDULE;
    }
  },
  saveSchedule(items: ScheduleItem[]) {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Error saving schedule:", e);
    }
  },

  getScannedDocs(): DocumentScanResult[] {
    try {
      const data = localStorage.getItem(SCAN_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveScannedDocs(docs: DocumentScanResult[]) {
    try {
      localStorage.setItem(SCAN_KEY, JSON.stringify(docs));
    } catch (e) {
      console.warn("Error saving docs:", e);
    }
  },

  getMoodHistory(): MoodEntry[] {
    try {
      const data = localStorage.getItem(MOOD_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveMoodHistory(entries: MoodEntry[]) {
    try {
      localStorage.setItem(MOOD_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn("Error saving mood history:", e);
    }
  },

  getImages(): GeneratedImage[] {
    try {
      const data = localStorage.getItem(IMAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveImages(images: GeneratedImage[]) {
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
    } catch (e) {
      console.warn("Error saving images:", e);
    }
  },

  getVideos(): GeneratedVideo[] {
    try {
      const data = localStorage.getItem(VIDEOS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveVideos(videos: GeneratedVideo[]) {
    try {
      localStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
    } catch (e) {
      console.warn("Error saving videos:", e);
    }
  },

  getPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(PREFS_KEY);
      return data ? { ...DEFAULT_PREFS, ...JSON.parse(data) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  },
  savePreferences(prefs: UserPreferences) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn("Error saving prefs:", e);
    }
  },
};
