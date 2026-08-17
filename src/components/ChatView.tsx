import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Paperclip,
  Volume2,
  VolumeX,
  Sparkles,
  Brain,
  CalendarPlus,
  Check,
  Copy,
  Trash2,
  Camera,
  X,
  RefreshCw,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  ChatMessage,
  AttachedImage,
  ScheduleItem,
  UserPreferences,
} from "../types";
import {
  sounds,
  createSpeechRecognizer,
  speakWithBrowser,
  stopAllSpeech,
} from "../utils/audio";

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (
    content: string,
    images?: AttachedImage[],
    deepReasoning?: boolean
  ) => Promise<void>;
  onClearChat: () => void;
  onAddScheduleItem: (item: Omit<ScheduleItem, "id" | "createdAt" | "completed">) => void;
  prefs: UserPreferences;
  isLoading: boolean;
}

const QUICK_PROMPTS = [
  {
    icon: "🗓️",
    label: "Plan my day",
    prompt: "Help me structure an efficient schedule, time blocks, and priorities for today.",
  },
  {
    icon: "🧠",
    label: "Deep Reasoning",
    prompt: "Explain step-by-step how Artificial Neural Networks and Transformer attention mechanisms work.",
  },
  {
    icon: "📄",
    label: "Study Framework",
    prompt: "Create a 5-step active recall and spaced repetition framework for mastering long complex topics.",
  },
  {
    icon: "💚",
    label: "EQ Check-in",
    prompt: "I'm feeling a bit overwhelmed by my workload today. Can you offer some comforting perspective and guidance?",
  },
  {
    icon: "🌐",
    label: "Multilingual Q&A",
    prompt: "Translate and explain the core principles of 'Critical Thinking' with practical everyday examples.",
  },
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  onAddScheduleItem,
  prefs,
  isLoading,
}) => {
  const [input, setInput] = useState("");
  const [deepReasoning, setDeepReasoning] = useState(prefs.deepReasoningDefault);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<Record<string, boolean>>({});
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<any>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle Speech Recognition
  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
    } else {
      sounds.playChime("listening");
      const recognizer = createSpeechRecognizer(
        prefs.language,
        (result) => {
          setInput((prev) => {
            const separator = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
            return prev + separator + result.transcript;
          });
        },
        () => setIsListening(false),
        () => setIsListening(false)
      );

      if (recognizer.supported) {
        recognizerRef.current = recognizer;
        recognizer.start();
        setIsListening(true);
      } else {
        alert("Speech recognition is not supported in this browser. You can type or use Chrome/Safari.");
      }
    }
  };

  // Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachedImages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            base64,
            mimeType: file.type,
            name: file.name,
            previewUrl: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Live Camera Snap
  const openCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err);
      alert("Unable to open camera. Please check permissions or upload an image file instead.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg");
      setAttachedImages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          base64,
          mimeType: "image/jpeg",
          name: `Camera-Snap-${Date.now()}.jpg`,
          previewUrl: base64,
        },
      ]);
    }
    closeCamera();
  };

  const closeCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // Submit message
  const handleSend = async () => {
    if ((!input.trim() && attachedImages.length === 0) || isLoading) return;

    const textToSend = input.trim();
    const imagesToSend = [...attachedImages];

    setInput("");
    setAttachedImages([]);

    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
    }

    await onSendMessage(textToSend, imagesToSend, deepReasoning);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // TTS playback
  const handlePlayTTS = async (msg: ChatMessage) => {
    if (playingAudioId === msg.id) {
      stopAllSpeech();
      setPlayingAudioId(null);
      return;
    }

    setPlayingAudioId(msg.id);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: msg.content,
          voiceName: prefs.ttsVoiceName,
        }),
      });
      const data = await res.json();

      if (data.success && data.audioBase64) {
        await sounds.playPcmBase64(data.audioBase64, 24000);
        setPlayingAudioId(null);
      } else {
        // Fallback to browser Web Speech API
        speakWithBrowser(msg.content, {
          lang: prefs.language,
          rate: prefs.speechRate,
          onEnd: () => setPlayingAudioId(null),
        });
      }
    } catch (e) {
      speakWithBrowser(msg.content, {
        lang: prefs.language,
        rate: prefs.speechRate,
        onEnd: () => setPlayingAudioId(null),
      });
    }
  };

  // Copy message text
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add suggested schedule item
  const handleAddSuggestedSchedule = (
    suggestionKey: string,
    sugg: {
      title: string;
      date?: string;
      time?: string;
      priority?: any;
      category?: any;
    }
  ) => {
    const today = new Date().toISOString().split("T")[0];
    onAddScheduleItem({
      title: sugg.title,
      date: sugg.date || today,
      time: sugg.time || "10:00",
      priority: sugg.priority || "normal",
      category: sugg.category || "personal",
      notes: "Auto-extracted from ELARA chat assistant",
      reminderMinutesBefore: 15,
    });

    setAddedSuggestions((prev) => ({ ...prev, [suggestionKey]: true }));
    sounds.playChime("complete");
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Top Banner Toolbar */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Deep Reasoning Toggle */}
          <button
            onClick={() => setDeepReasoning(!deepReasoning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deepReasoning
                ? "bg-purple-950/80 text-purple-300 border border-purple-700/80 shadow-md shadow-purple-900/30"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"
            }`}
            title="Enable Gemini 3.7 Deep Thinking for rigorous logic & complex problem breakdown"
          >
            <Brain className={`w-3.5 h-3.5 ${deepReasoning ? "text-purple-400 animate-pulse" : ""}`} />
            <span>Deep Reasoning {deepReasoning ? "ON" : "OFF"}</span>
            {deepReasoning && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            )}
          </button>

          <span className="text-xs text-slate-500 hidden sm:inline-block">
            {deepReasoning ? "Higher intelligence analysis" : "Fast responsive mode"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isAssistant = msg.role === "assistant";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl mx-auto ${
                isAssistant ? "justify-start" : "justify-end"
              }`}
            >
              {isAssistant && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-cyan-900/30 mt-1">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`flex flex-col space-y-1.5 max-w-[88%] sm:max-w-[80%] ${
                  isAssistant ? "items-start" : "items-end"
                }`}
              >
                {/* Images Attachment Preview if any */}
                {msg.images && msg.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {msg.images.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-xl overflow-hidden border border-slate-700 shadow-md max-w-xs"
                      >
                        <img
                          src={img.previewUrl}
                          alt="Attached"
                          className="max-h-48 object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed ${
                    isAssistant
                      ? "bg-slate-900/90 text-slate-100 border border-slate-800/90 shadow-sm"
                      : "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-950/40"
                  }`}
                >
                  {isAssistant ? (
                    <div className="prose prose-invert prose-sm max-w-none space-y-2 prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Schedule Suggestions Card if detected */}
                  {msg.scheduleSuggestions && msg.scheduleSuggestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Nai-detect na Paalala / Schedule:</span>
                      </div>
                      {msg.scheduleSuggestions.map((sugg, idx) => {
                        const key = `${msg.id}-${idx}`;
                        const isAdded = addedSuggestions[key];
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-200">{sugg.title}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>📅 {sugg.date || "Today"}</span>
                                {sugg.time && <span>⏰ {sugg.time}</span>}
                                {sugg.priority && (
                                  <span className="capitalize text-amber-400">
                                    • {sugg.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              disabled={isAdded}
                              onClick={() => handleAddSuggestedSchedule(key, sugg)}
                              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                                isAdded
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-sm"
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Naidagdag!</span>
                                </>
                              ) : (
                                <>
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                  <span>Add to Schedule</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Message Meta & Action Bar */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
                  <span>{msg.timestamp}</span>
                  {isAssistant && (
                    <>
                      <span>•</span>
                      <button
                        onClick={() => handlePlayTTS(msg)}
                        className="hover:text-cyan-400 flex items-center gap-1 transition-colors"
                        title="Speak / Basahin nang malakas"
                      >
                        {playingAudioId === msg.id ? (
                          <>
                            <VolumeX className="w-3 h-3 text-cyan-400 animate-pulse" />
                            <span className="text-cyan-400">Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-4xl mx-auto items-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-cyan-900/30">
              <Sparkles className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-medium text-slate-400">
                {deepReasoning ? "ELARA is deeply analyzing step-by-step..." : "ELARA is thinking..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Camera Live Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-200">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Camera Document / Photo Capture</span>
              </div>
              <button
                onClick={closeCamera}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-xl bg-black aspect-video object-cover"
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={closeCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <Camera className="w-4 h-4" />
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Area: Quick Prompts & Composer */}
      <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800/90 space-y-3">
        {/* Quick prompt chips */}
        {messages.length < 3 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar max-w-4xl mx-auto">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => setInput(qp.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 whitespace-nowrap transition-colors flex-shrink-0"
              >
                <span>{qp.icon}</span>
                <span>{qp.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Attached preview chips */}
        {attachedImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-4xl mx-auto">
            {attachedImages.map((img) => (
              <div
                key={img.id}
                className="relative group w-14 h-14 rounded-xl overflow-hidden border border-cyan-500/50 flex-shrink-0"
              >
                <img
                  src={img.previewUrl}
                  alt="Attachment"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() =>
                    setAttachedImages((prev) => prev.filter((i) => i.id !== img.id))
                  }
                  className="absolute inset-0 bg-slate-950/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Composer Box */}
        <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-slate-900/90 border border-slate-800 focus-within:border-cyan-500/80 rounded-2xl p-2 transition-all shadow-lg shadow-slate-950/50">
          {/* File & Camera Attachments */}
          <div className="flex items-center gap-1 pb-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
              title="Attach Document or Image"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openCamera}
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors hidden sm:inline-flex"
              title="Take Photo with Camera"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Text Area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "ELARA is listening... speak clearly..."
                : "Ask ELARA anything or give a task (Type or speak in any language)..."
            }
            rows={1}
            className="flex-1 max-h-32 min-h-[40px] bg-transparent text-slate-100 text-sm placeholder:text-slate-500 resize-none outline-none py-2 px-1"
          />

          {/* Voice Input & Send Buttons */}
          <div className="flex items-center gap-1 pb-1">
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-xl transition-all ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30"
                  : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80"
              }`}
              title={isListening ? "Stop listening" : "Speak to ELARA (Voice Recognition)"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
              onClick={handleSend}
              className={`p-2.5 rounded-xl transition-all ${
                (!input.trim() && attachedImages.length === 0) || isLoading
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 active:scale-95"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
