import React, { useState, useEffect, useRef } from "react";
import {
  Video as VideoIcon,
  Sparkles,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Ratio,
  Film,
  Upload,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import confetti from "canvas-confetti";
import { GeneratedVideo, GeneratedImage } from "../types";
import { sounds } from "../utils/audio";

interface VideoStudioViewProps {
  videos: GeneratedVideo[];
  savedImages?: GeneratedImage[];
  onSaveVideo: (video: GeneratedVideo) => void;
  onUpdateVideo: (video: GeneratedVideo) => void;
  onDeleteVideo: (id: string) => void;
  onSendToChat?: (video: GeneratedVideo) => void;
}

const SAMPLE_PROMPTS = [
  "A majestic eagle gliding gracefully over snow-capped mountains at sunrise, golden sunlight reflecting on icy peaks",
  "A cyberpunk night street in Manila with neon signs reflected on wet asphalt, flying hovercrafts passing by",
  "A macro view of an intricate brass steampunk pocket watch ticking, gears spinning smoothly with warm candlelight",
  "A cute robotic assistant watering vibrant exotic flowers in a greenhouse pod floating in deep space",
  "Calm ocean waves gently crashing onto bioluminescent turquoise sands under a star-filled starry night sky",
  "A barista pouring latte art in slow motion, steaming creamy espresso blending into a perfect rosette pattern",
];

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  videos,
  savedImages = [],
  onSaveVideo,
  onUpdateVideo,
  onDeleteVideo,
  onSendToChat,
}) => {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [startingImage, setStartingImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    videos[0] || null
  );
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Update selected video if list changes and nothing selected
  useEffect(() => {
    if (!selectedVideo && videos.length > 0) {
      setSelectedVideo(videos[0]);
    }
  }, [videos, selectedVideo]);

  // Handle Video Generation Start
  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setErrorMessage(null);
    setIsGenerating(true);
    setProgressPercent(10);
    setPollingStatus("Contacting Veo 3 engine...");

    const tempId = Math.random().toString(36).substring(2, 9);
    const newVideo: GeneratedVideo = {
      id: tempId,
      operationName: "",
      prompt: prompt.trim(),
      aspectRatio,
      status: "pending",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      sourceImage: startingImage || undefined,
    };

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          startingImageBase64: startingImage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.operationName) {
        throw new Error(data.error || "Failed to start Veo 3 video generation.");
      }

      newVideo.operationName = data.operationName;
      newVideo.status = "processing";
      onSaveVideo(newVideo);
      setSelectedVideo(newVideo);
      setActiveVideoId(newVideo.id);

      // Start Polling for completion
      startPolling(newVideo.id, data.operationName);
    } catch (err: any) {
      console.error("Veo 3 generation error:", err);
      setErrorMessage(err.message || "Failed to start video generation.");
      setIsGenerating(false);
      setProgressPercent(0);
      setPollingStatus("");
    }
  };

  // Poll Operation Status
  const startPolling = (videoId: string, operationName: string) => {
    let elapsedSeconds = 0;
    setProgressPercent(20);
    setPollingStatus("Veo 3 is rendering frames (720p)...");

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      elapsedSeconds += 5;
      // Simulated progress ramp
      setProgressPercent((prev) => {
        if (prev < 90) return prev + 8;
        return 92;
      });

      setPollingStatus(
        elapsedSeconds < 25
          ? "Synthesizing motion dynamics & physics..."
          : elapsedSeconds < 50
          ? "Applying cinematic lighting & temporal smoothing..."
          : "Encoding video stream..."
      );

      try {
        const res = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName }),
        });

        const data = await res.json();

        if (data.done) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;

          if (data.error) {
            throw new Error(data.error.message || "Veo 3 generation failed.");
          }

          // Fetch or prepare download stream URL
          const streamUrl = `/api/video-stream?operationName=${encodeURIComponent(
            operationName
          )}`;

          const updated: GeneratedVideo = {
            id: videoId,
            operationName,
            prompt,
            aspectRatio,
            status: "completed",
            videoUrl: streamUrl,
            createdAt: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            sourceImage: startingImage || undefined,
          };

          onUpdateVideo(updated);
          setSelectedVideo(updated);
          setIsGenerating(false);
          setProgressPercent(100);
          setPollingStatus("Video generated successfully!");
          sounds.playChime("complete");
          confetti({ particleCount: 50, spread: 80, origin: { y: 0.8 } });
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsGenerating(false);
        setErrorMessage(err.message || "Failed to complete video generation.");
        const failed: GeneratedVideo = {
          id: videoId,
          operationName,
          prompt,
          aspectRatio,
          status: "failed",
          error: err.message,
          createdAt: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        onUpdateVideo(failed);
      }
    }, 5000);
  };

  // Image Upload for Video Starting Frame
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setStartingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <VideoIcon className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Veo 3 Video Studio
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                veo-3.1-fast-generate-preview
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate high-fidelity cinematic video from text prompts with Google's state-of-the-art Veo 3 model.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Controls & Input */}
        <div className="w-full lg:w-[420px] bg-slate-950/80 border-r border-slate-800/80 p-4 sm:p-6 overflow-y-auto space-y-5 flex-shrink-0">
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Prompt Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Video Prompt</span>
                <span className="text-[10px] text-rose-400 font-normal">
                  ✨ Veo 3 Fast Preview
                </span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the action, scene, lighting, camera movement, and aesthetic details in vivid detail..."
                rows={4}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 resize-none transition-all"
                disabled={isGenerating}
              />
            </div>

            {/* Aspect Ratio Selector (Strictly 16:9 or 9:16) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Ratio className="w-3.5 h-3.5 text-rose-400" />
                <span>Aspect Ratio (Required: 16:9 or 9:16)</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAspectRatio("16:9")}
                  disabled={isGenerating}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col items-center justify-center gap-1.5 ${
                    aspectRatio === "16:9"
                      ? "bg-rose-500/15 border-rose-500 text-rose-200 ring-2 ring-rose-500/20 shadow-md"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="w-10 h-6 border-2 border-current rounded flex items-center justify-center text-[9px] font-bold">
                    16:9
                  </div>
                  <span className="text-xs font-semibold">Landscape (16:9)</span>
                  <span className="text-[10px] text-slate-500">Desktop & YouTube</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAspectRatio("9:16")}
                  disabled={isGenerating}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col items-center justify-center gap-1.5 ${
                    aspectRatio === "9:16"
                      ? "bg-rose-500/15 border-rose-500 text-rose-200 ring-2 ring-rose-500/20 shadow-md"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="w-6 h-10 border-2 border-current rounded flex items-center justify-center text-[9px] font-bold">
                    9:16
                  </div>
                  <span className="text-xs font-semibold">Portrait (9:16)</span>
                  <span className="text-[10px] text-slate-500">Reels, Shorts & Stories</span>
                </button>
              </div>
            </div>

            {/* Optional Starting Frame / Image Animate */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Starting Frame / Animate Image</span>
                </label>
                {startingImage && (
                  <button
                    type="button"
                    onClick={() => setStartingImage(null)}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {startingImage ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-36 bg-slate-900">
                  <img
                    src={startingImage}
                    alt="Starting frame"
                    className="w-full h-36 object-contain"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-950/80 rounded text-[10px] text-cyan-300">
                    Image will be animated with Veo 3
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="flex-1 p-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-600 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upload image to animate</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Quick Select from Saved Images */}
              {!startingImage && savedImages.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500">Or pick from Image Studio:</span>
                  <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                    {savedImages.slice(0, 4).map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setStartingImage(img.imageUrl)}
                        className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 hover:border-rose-400 flex-shrink-0 transition-all"
                        title={img.prompt}
                      >
                        <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Veo 3 Generating Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Video with Veo 3</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Prompts Inspiration */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <span className="text-xs font-bold text-slate-400">Cinematic Ideas</span>
            <div className="space-y-1.5">
              {SAMPLE_PROMPTS.slice(0, 3).map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  disabled={isGenerating}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700 text-slate-300 text-xs transition-all flex items-start gap-2 group"
                >
                  <span className="text-rose-400 mt-0.5">🎬</span>
                  <span className="line-clamp-2 leading-relaxed text-slate-300 group-hover:text-white">
                    {sample}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Video Display & Gallery */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950/50 p-4 sm:p-6 space-y-6">
          {/* Active Generation Progress Card */}
          {isGenerating && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-rose-950/20 border border-rose-500/30 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 animate-pulse">
                    <VideoIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm sm:text-base">
                      Veo 3 Video Synthesis in Progress
                    </h3>
                    <p className="text-xs text-rose-300/80">{pollingStatus}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Veo 3 typically takes 30-60s for full 720p cinematic rendering</span>
                </span>
                <span className="font-semibold text-slate-300">{aspectRatio}</span>
              </div>
            </div>
          )}

          {/* Featured Video Player */}
          {selectedVideo && selectedVideo.status === "completed" && selectedVideo.videoUrl && (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Veo 3 (720p)
                    </span>
                    <span className="text-xs text-slate-400">
                      Aspect Ratio: {selectedVideo.aspectRatio}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">{selectedVideo.createdAt}</span>
                  </div>
                  <p className="text-sm font-semibold text-white line-clamp-1">
                    {selectedVideo.prompt}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyPrompt(selectedVideo.id, selectedVideo.prompt)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
                    title="Copy Prompt"
                  >
                    {copiedId === selectedVideo.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Copy Prompt</span>
                  </button>

                  <a
                    href={`${selectedVideo.videoUrl}&download=true`}
                    download="elara-veo3-video.mp4"
                    className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(selectedVideo)}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
                    >
                      Discuss in Chat
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteVideo(selectedVideo.id)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all"
                    title="Delete Video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Video Player Display */}
              <div
                className={`w-full bg-black flex items-center justify-center p-2 sm:p-4 ${
                  selectedVideo.aspectRatio === "9:16" ? "max-h-[600px]" : "max-h-[480px]"
                }`}
              >
                <video
                  key={selectedVideo.videoUrl}
                  src={selectedVideo.videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className={`rounded-xl shadow-2xl max-h-full object-contain ${
                    selectedVideo.aspectRatio === "9:16" ? "max-w-xs" : "max-w-3xl w-full"
                  }`}
                />
              </div>

              {/* Prompt Description Footer */}
              <div className="p-4 bg-slate-900/60 border-t border-slate-800/80 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Full Prompt: </span>
                {selectedVideo.prompt}
              </div>
            </div>
          )}

          {/* Empty State when no video selected and not generating */}
          {(!selectedVideo || selectedVideo.status !== "completed") && !isGenerating && (
            <div className="p-12 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <VideoIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Create Your First Veo 3 Video
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                Enter a descriptive visual prompt on the left, pick your aspect ratio (16:9 for landscape or 9:16 for portrait/reels), and generate video powered by Veo 3.
              </p>
            </div>
          )}

          {/* Video Gallery */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Veo 3 Video Archive</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {videos.length}
                </span>
              </h3>
            </div>

            {videos.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No generated videos yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => setSelectedVideo(vid)}
                    className={`cursor-pointer rounded-xl overflow-hidden border transition-all ${
                      selectedVideo?.id === vid.id
                        ? "border-rose-500 ring-2 ring-rose-500/20 bg-slate-900"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="aspect-video bg-black flex items-center justify-center relative group">
                      {vid.videoUrl ? (
                        <video
                          src={vid.videoUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-1">
                          <Film className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px] capitalize">{vid.status}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white drop-shadow" />
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono font-semibold text-rose-300">
                        {vid.aspectRatio}
                      </span>
                    </div>

                    <div className="p-3 space-y-1">
                      <p className="text-xs font-medium text-slate-200 line-clamp-1">
                        {vid.prompt}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{vid.createdAt}</span>
                        <span className="uppercase font-semibold text-rose-400">Veo 3</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
