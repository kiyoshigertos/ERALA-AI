import React, { useState, useEffect } from "react";
import {
  ActiveTab,
  ChatMessage,
  ScheduleItem,
  DocumentScanResult,
  MoodEntry,
  GeneratedImage,
  GeneratedVideo,
  UserPreferences,
  AttachedImage,
} from "./types";
import { storage } from "./utils/storage";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { ScheduleView } from "./components/ScheduleView";
import { DocumentScannerView } from "./components/DocumentScannerView";
import { CompanionView } from "./components/CompanionView";
import { ImageStudioView } from "./components/ImageStudioView";
import { VideoStudioView } from "./components/VideoStudioView";
import { LiveVoiceOrb } from "./components/LiveVoiceOrb";
import { SettingsModal } from "./components/SettingsModal";
import { sounds } from "./utils/audio";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [prefs, setPrefs] = useState<UserPreferences>(storage.getPreferences());
  const [messages, setMessages] = useState<ChatMessage[]>(storage.getMessages());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(storage.getSchedule());
  const [scannedDocs, setScannedDocs] = useState<DocumentScanResult[]>(storage.getScannedDocs());
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>(storage.getMoodHistory());
  const [images, setImages] = useState<GeneratedImage[]>(storage.getImages());
  const [videos, setVideos] = useState<GeneratedVideo[]>(storage.getVideos());

  const [isVoiceOrbOpen, setIsVoiceOrbOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [deviceView, setDeviceView] = useState<"responsive" | "mobile" | "tablet" | "desktop">(
    "responsive"
  );

  // Sync state to local storage
  useEffect(() => {
    storage.savePreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    storage.saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    storage.saveSchedule(scheduleItems);
  }, [scheduleItems]);

  useEffect(() => {
    storage.saveScannedDocs(scannedDocs);
  }, [scannedDocs]);

  useEffect(() => {
    storage.saveMoodHistory(moodHistory);
  }, [moodHistory]);

  useEffect(() => {
    storage.saveImages(images);
  }, [images]);

  useEffect(() => {
    storage.saveVideos(videos);
  }, [videos]);

  // Handle Send Chat Message
  const handleSendMessage = async (
    content: string,
    attachedImages: AttachedImage[] = [],
    deepReasoning: boolean = false
  ) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      images: attachedImages,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-8), // Send recent context
          prompt: content,
          images: attachedImages,
          language: prefs.language,
          persona: prefs.persona,
          deepReasoning,
          userMood: moodHistory[0]?.dominantEmotion || "neutral",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Pansamantalang mataas ang demand ng AI model. Pakisubukan muli.");
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: "assistant",
        content: data.text || "Walang naibigay na sagot. Pakisubukan muli.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        scheduleSuggestions: data.scheduleSuggestions || [],
        isDeepReasoning: deepReasoning,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      sounds.playChime("gentle");
    } catch (err: any) {
      console.error("Chat error:", err);
      const isHighDemand = (err.message || "").toLowerCase().includes("demand") || (err.message || "").toLowerCase().includes("503");
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: "assistant",
        content: isHighDemand
          ? "⚠️ Medyo mataas ang demand sa AI server ngayon. Sinubukang i-retry ngunit pansamantalang abala. Pakipindot o subukan muli pagkaraan ng ilang segundo."
          : `Paumanhin, nagkaroon ng pansamantalang problema sa koneksyon (${err.message}). Pakisubukan muli.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm("Nais mo bang burahin ang kasalukuyang chat history?")) {
      const welcome = storage.getMessages().slice(0, 1);
      setMessages(welcome);
    }
  };

  // Schedule Handlers
  const handleAddScheduleItem = (
    item: Omit<ScheduleItem, "id" | "createdAt" | "completed">
  ) => {
    const newItem: ScheduleItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setScheduleItems((prev) => [newItem, ...prev]);
  };

  const handleToggleComplete = (id: string) => {
    setScheduleItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleDeleteScheduleItem = (id: string) => {
    setScheduleItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Document Handlers
  const handleSaveDoc = (doc: DocumentScanResult) => {
    setScannedDocs((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
  };

  const handleDeleteDoc = (id: string) => {
    setScannedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  // Mood Handlers
  const handleSaveMoodEntry = (entry: MoodEntry) => {
    setMoodHistory((prev) => [entry, ...prev]);
  };

  // Image Handlers
  const handleSaveImage = (img: GeneratedImage) => {
    setImages((prev) => [img, ...prev]);
  };

  const handleDeleteImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  // Video Handlers (Veo 3)
  const handleSaveVideo = (video: GeneratedVideo) => {
    setVideos((prev) => [video, ...prev]);
  };

  const handleUpdateVideo = (updated: GeneratedVideo) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const handleDeleteVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  // Reset All Data
  const handleResetAllData = () => {
    localStorage.clear();
    setMessages(storage.getMessages());
    setScheduleItems(storage.getSchedule());
    setScannedDocs([]);
    setMoodHistory([]);
    setImages([]);
    setVideos([]);
  };

  // Viewport framing container based on Device Simulation Selection
  const getDeviceContainerClass = () => {
    switch (deviceView) {
      case "mobile":
        return "max-w-sm w-full mx-auto my-auto h-[90vh] shadow-2xl border-4 border-slate-800 rounded-[2.5rem] overflow-hidden bg-slate-950 flex flex-col";
      case "tablet":
        return "max-w-3xl w-full mx-auto my-auto h-[92vh] shadow-2xl border-4 border-slate-800 rounded-[2rem] overflow-hidden bg-slate-950 flex flex-col";
      case "desktop":
        return "max-w-6xl w-full mx-auto my-auto h-[95vh] shadow-2xl border-4 border-slate-800 rounded-2xl overflow-hidden bg-slate-950 flex flex-col";
      default:
        return "w-full h-screen flex flex-col bg-slate-950";
    }
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center ${deviceView !== "responsive" ? "p-3 sm:p-6 bg-slate-900/90" : ""}`}>
      <div className={getDeviceContainerClass()}>
        {/* Top Header */}
        <Header
          prefs={prefs}
          onUpdatePrefs={setPrefs}
          onOpenVoiceMode={() => setIsVoiceOrbOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          deviceView={deviceView}
          onChangeDeviceView={setDeviceView}
          onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        />

        {/* Main Application Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Navigation Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              if (tab === "live-voice") {
                setIsVoiceOrbOpen(true);
              } else {
                setActiveTab(tab);
              }
            }}
            scheduleItems={scheduleItems}
            isOpenMobile={isSidebarOpenMobile}
            onCloseMobile={() => setIsSidebarOpenMobile(false)}
          />

          {/* Active View Module */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "chat" && (
              <ChatView
                messages={messages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                onAddScheduleItem={handleAddScheduleItem}
                prefs={prefs}
                isLoading={isChatLoading}
              />
            )}

            {activeTab === "schedule" && (
              <ScheduleView
                items={scheduleItems}
                onAddItem={handleAddScheduleItem}
                onToggleComplete={handleToggleComplete}
                onDeleteItem={handleDeleteScheduleItem}
              />
            )}

            {activeTab === "scanner" && (
              <DocumentScannerView
                scannedDocs={scannedDocs}
                onSaveDoc={handleSaveDoc}
                onDeleteDoc={handleDeleteDoc}
                onAddScheduleItem={handleAddScheduleItem}
              />
            )}

            {activeTab === "companion" && (
              <CompanionView
                moodHistory={moodHistory}
                onSaveMoodEntry={handleSaveMoodEntry}
                prefs={prefs}
              />
            )}

            {activeTab === "images" && (
              <ImageStudioView
                images={images}
                onSaveImage={handleSaveImage}
                onDeleteImage={handleDeleteImage}
                onSendToChat={(img) => {
                  setActiveTab("chat");
                  handleSendMessage(`I-analyze o magbigay ng kwento tungkol sa nalikhang larawang ito: "${img.prompt}"`);
                }}
              />
            )}

            {activeTab === "videos" && (
              <VideoStudioView
                videos={videos}
                savedImages={images}
                onSaveVideo={handleSaveVideo}
                onUpdateVideo={handleUpdateVideo}
                onDeleteVideo={handleDeleteVideo}
                onSendToChat={(vid) => {
                  setActiveTab("chat");
                  handleSendMessage(`I-analyze o magbigay ng kwento tungkol sa nalikhang Veo 3 video na ito: "${vid.prompt}"`);
                }}
              />
            )}

            {activeTab === "settings" && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
                <SettingsModal
                  isOpen={true}
                  onClose={() => setActiveTab("chat")}
                  prefs={prefs}
                  onSavePrefs={setPrefs}
                  onResetAllData={handleResetAllData}
                />
              </div>
            )}
          </main>
        </div>

        {/* Live Voice Orb Modal Overlay */}
        <LiveVoiceOrb
          isOpen={isVoiceOrbOpen}
          onClose={() => setIsVoiceOrbOpen(false)}
          prefs={prefs}
          onTranscriptReceived={(transcript, response) => {
            setMessages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                role: "user",
                content: transcript,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
              {
                id: Math.random().toString(36).substring(2, 9),
                role: "assistant",
                content: response,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ]);
          }}
        />

        {/* Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            prefs={prefs}
            onSavePrefs={setPrefs}
            onResetAllData={handleResetAllData}
          />
        )}
      </div>
    </div>
  );
}
