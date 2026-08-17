export type ActiveTab =
  | "chat"
  | "schedule"
  | "scanner"
  | "companion"
  | "images"
  | "live-voice"
  | "settings";

export type LanguageCode =
  | "english"
  | "auto"
  | "filipino"
  | "taglish"
  | "cebuano"
  | "ilocano"
  | "spanish"
  | "japanese"
  | "french"
  | "german"
  | "chinese";

export type PersonaMode =
  | "balanced"
  | "companion"
  | "analyst"
  | "productivity";

export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: string;
  name?: string;
  previewUrl: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  images?: AttachedImage[];
  reasoningSteps?: string[];
  isDeepReasoning?: boolean;
  scheduleSuggestions?: Array<{
    title: string;
    date?: string;
    time?: string;
    priority?: "urgent" | "high" | "normal" | "relaxed";
    category?: "work" | "personal" | "study" | "health" | "errands";
  }>;
  audioBase64?: string;
  languageUsed?: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  category: "work" | "personal" | "study" | "health" | "errands";
  priority: "urgent" | "high" | "normal" | "relaxed";
  notes?: string;
  completed: boolean;
  reminderMinutesBefore?: number;
  createdAt: string;
}

export interface DocumentScanResult {
  id: string;
  title: string;
  documentType: string;
  language: string;
  rawText: string;
  executiveSummary: string;
  keyPoints: string[];
  actionItems: Array<{
    task: string;
    dueDate?: string;
    priority?: "urgent" | "high" | "normal";
  }>;
  entities: Array<{
    label: string;
    value: string;
  }>;
  translatedSummary?: string;
  confidenceScore?: number;
  previewImage?: string;
  timestamp: string;
}

export interface MoodEntry {
  id: string;
  timestamp: string;
  moodRating: number; // 1 to 5
  dominantEmotion: string;
  note?: string;
  empathyReflection: string;
  filipinoComfortQuote: string; // Comfort quote / inspiring proverb
  mindfulnessExercise?: {
    name: string;
    steps: string[];
  };
  suggestedWellnessAction?: string;
  positivityScore?: number;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  aspectRatio: string;
  imageUrl: string;
  textDescription?: string;
  createdAt: string;
}

export interface UserPreferences {
  userName: string;
  language: LanguageCode;
  persona: PersonaMode;
  deepReasoningDefault: boolean;
  voiceAutoPlay: boolean;
  ttsVoiceName: "Kore" | "Puck" | "Fenrir" | "Zephyr" | "Charon";
  speechRate: number; // 0.8 to 1.5
  theme: "dark" | "light" | "system";
  notificationSound: boolean;
}

