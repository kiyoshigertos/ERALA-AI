import React, { useState } from "react";
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  Send,
  Wand2,
  Trash2,
  Ratio,
  Palette,
} from "lucide-react";
import confetti from "canvas-confetti";
import { GeneratedImage } from "../types";
import { sounds } from "../utils/audio";

interface ImageStudioViewProps {
  images: GeneratedImage[];
  onSaveImage: (img: GeneratedImage) => void;
  onDeleteImage: (id: string) => void;
  onSendToChat?: (img: GeneratedImage) => void;
}

const STYLES = [
  { id: "vibrant digital art", label: "Digital Art", icon: "🎨" },
  { id: "photorealistic ultra 8k cinematic lighting", label: "Photorealistic", icon: "📸" },
  { id: "anime studio ghibli aesthetic", label: "Anime / Ghibli", icon: "✨" },
  { id: "cyberpunk futuristic neon glow", label: "Cyberpunk", icon: "🌆" },
  { id: "3d render octane glossy minimalist", label: "3D Render", icon: "🧊" },
  { id: "traditional watercolor dreamy wash", label: "Watercolor", icon: "🖌️" },
  { id: "filipino cultural indigenous modern fantasy art", label: "Filipino Art", icon: "🇵🇭" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 Square", desc: "Instagram & Avatars" },
  { id: "16:9", label: "16:9 Landscape", desc: "Desktop & YouTube" },
  { id: "9:16", label: "9:16 Portrait", desc: "Mobile & Stories" },
  { id: "4:3", label: "4:3 Classic", desc: "Tablet & Standard" },
  { id: "3:4", label: "3:4 Book", desc: "Poster & Cover" },
];

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  images,
  onSaveImage,
  onDeleteImage,
  onSendToChat,
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    images[0] || null
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          aspectRatio: selectedRatio,
          enhancePrompt: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        const newImg: GeneratedImage = {
          id: Math.random().toString(36).substring(2, 9),
          prompt: prompt.trim(),
          enhancedPrompt: data.enhancedPrompt,
          style: selectedStyle,
          aspectRatio: selectedRatio,
          imageUrl: data.imageUrl,
          textDescription: data.textDescription,
          createdAt: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        onSaveImage(newImg);
        setSelectedImage(newImg);
        sounds.playChime("complete");
        confetti({ particleCount: 45, spread: 70, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
      alert("Failed to generate image. Please try again with a different prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (img: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = img.imageUrl;
    link.download = `ELARA_${img.prompt.slice(0, 20).replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              AI Image Studio
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Create high-quality visual art, diagrams, wallpapers, and conceptual illustrations with Gemini.
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Generator Controls */}
        <div className="w-full lg:w-96 bg-slate-950/80 border-r border-slate-800/80 p-4 sm:p-6 overflow-y-auto space-y-5 flex-shrink-0">
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Prompt Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Visual Prompt</span>
                <span className="text-[10px] text-purple-400 font-normal">
                  ✨ Auto-enhanced with ELARA
                </span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your vision (e.g. 'A futuristic metropolis with neon skylines and sleek elevated trains' or 'A cozy coffee shop on a rainy afternoon in cyberpunk aesthetic')..."
                rows={3}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Style Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Artistic Style</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-2 rounded-xl text-left border text-xs transition-all flex items-center gap-2 ${
                      selectedStyle === style.id
                        ? "bg-purple-950/80 text-purple-200 border-purple-600 font-semibold shadow-sm"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span>{style.icon}</span>
                    <span className="truncate">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Ratio className="w-3.5 h-3.5 text-purple-400" />
                <span>Aspect Ratio</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    type="button"
                    onClick={() => setSelectedRatio(ratio.id)}
                    className={`p-2 rounded-xl text-center border text-xs transition-all ${
                      selectedRatio === ratio.id
                        ? "bg-purple-950/80 text-purple-200 border-purple-600 font-semibold shadow-sm"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">{ratio.id}</div>
                    <div className="text-[9px] text-slate-500 truncate">{ratio.desc.split(" ")[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                !prompt.trim() || isGenerating
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 active:scale-95"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
              <span>{isGenerating ? "ELARA is generating..." : "Generate Artwork"}</span>
            </button>
          </form>

          {/* Quick Prompts */}
          <div className="pt-2 space-y-2 border-t border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sample Prompts
            </span>
            <div className="space-y-1.5">
              {[
                "Futuristic cybernetic owl perched on a high-tech crystal tower at night",
                "Traditional Filipino bahay kubo floating in space surrounded by luminous nebulae",
                "Minimalist isometric 3D smart home laboratory with holographic displays",
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="w-full text-left p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  &quot;{p}&quot;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Active Image Preview & Gallery */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 p-4 sm:p-6 space-y-4">
          {selectedImage ? (
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden space-y-3">
              <div className="relative max-h-[60vh] max-w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center group">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="max-h-[60vh] max-w-full object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 justify-between">
                  <div className="space-y-0.5 max-w-md">
                    <p className="text-xs font-semibold text-white line-clamp-2">
                      {selectedImage.prompt}
                    </p>
                    <span className="text-[10px] text-purple-300">
                      {selectedImage.style} • {selectedImage.aspectRatio}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(selectedImage)}
                      className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-colors"
                      title="Download image"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Bar for Selected Image */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => handleCopyPrompt(selectedImage.id, selectedImage.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  {copiedId === selectedImage.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === selectedImage.id ? "Copied" : "Copy Prompt"}</span>
                </button>

                <button
                  onClick={() => onDeleteImage(selectedImage.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <ImageIcon className="w-12 h-12 text-slate-700" />
              <h3 className="font-semibold text-slate-300 text-sm">No artwork generated yet</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Type a creative prompt in the left studio panel and pick a style to generate high-resolution AI art.
              </p>
            </div>
          )}

          {/* Gallery Carousel at Bottom */}
          {images.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Created Gallery ({images.length})
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className={`relative group w-16 h-16 rounded-xl overflow-hidden border cursor-pointer flex-shrink-0 transition-all ${
                      selectedImage?.id === img.id
                        ? "border-purple-500 shadow-md scale-105"
                        : "border-slate-800 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
