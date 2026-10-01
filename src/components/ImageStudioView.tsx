import React, { useState, useRef } from "react";
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
  Upload,
  Layers,
  ArrowRight,
  Eye,
  Sliders,
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

const EDIT_PRESETS = [
  "Add neon glowing cybernetic accents and neon reflections",
  "Change the setting to a dreamy sunset beach in Boracay",
  "Convert the style into a vibrant watercolor painting with soft brush strokes",
  "Add a dramatic cinematic thunderstorm sky in the background with lightning",
  "Transform into a futuristic anime concept art illustration",
];

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({
  images,
  onSaveImage,
  onDeleteImage,
  onSendToChat,
}) => {
  const [studioMode, setStudioMode] = useState<"create" | "edit">("create");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    images[0] || null
  );
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle Text-to-Image Generation
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

  // Handle Image-to-Image Editing
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sourceImage = imageToEdit || selectedImage?.imageUrl;
    if (!sourceImage || !editPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: editPrompt.trim(),
          imageBase64: sourceImage,
          aspectRatio: selectedRatio,
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        const editedImg: GeneratedImage = {
          id: Math.random().toString(36).substring(2, 9),
          prompt: `[Edited] ${editPrompt.trim()}`,
          style: selectedStyle,
          aspectRatio: selectedRatio,
          imageUrl: data.imageUrl,
          textDescription: data.textDescription,
          isEdited: true,
          originalImageUrl: sourceImage,
          createdAt: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        onSaveImage(editedImg);
        setSelectedImage(editedImg);
        sounds.playChime("complete");
        confetti({ particleCount: 50, spread: 75, origin: { y: 0.8 } });
        setEditPrompt("");
      }
    } catch (err) {
      console.error("Failed to edit image:", err);
      alert("Failed to edit image. Please try again with different instructions.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload custom image for editing
  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToEdit(reader.result as string);
      setStudioMode("edit");
    };
    reader.readAsDataURL(file);
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
      <div className="p-4 sm:p-5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ImageIcon className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              AI Image Studio
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Create & Edit
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create high-quality visual art and edit existing images with multimodal Gemini intelligence.
          </p>
        </div>

        {/* Mode Selector Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            type="button"
            onClick={() => setStudioMode("create")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              studioMode === "create"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate New</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode("edit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              studioMode === "edit"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Edit Image</span>
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Generator & Editor Controls */}
        <div className="w-full lg:w-[380px] bg-slate-950/80 border-r border-slate-800/80 p-4 sm:p-6 overflow-y-auto space-y-5 flex-shrink-0">
          {studioMode === "create" ? (
            /* CREATE MODE FORM */
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Visual Prompt</span>
                  <span className="text-[10px] text-purple-400 font-normal">
                    ✨ Enhanced with Gemini
                  </span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your visual concept in detail (e.g., A futuristic floating library with glowing orbs, cozy warm candlelight, lush hanging gardens)..."
                  rows={4}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all"
                  disabled={isGenerating}
                />
              </div>

              {/* Style Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  <span>Art Style</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-2 rounded-lg border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                        selectedStyle === style.id
                          ? "bg-purple-500/15 border-purple-500 text-purple-200"
                          : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      <span className="text-sm">{style.icon}</span>
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
                      className={`p-2 rounded-lg border text-center text-xs transition-all ${
                        selectedRatio === ratio.id
                          ? "bg-purple-500/15 border-purple-500 text-purple-200 font-bold"
                          : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-purple-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isGenerating ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Image...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Artwork</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* EDIT MODE FORM */
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Target Image to Edit</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload photo</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomUpload}
                  className="hidden"
                />

                {/* Source Image Preview */}
                {(imageToEdit || selectedImage?.imageUrl) ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 max-h-40">
                    <img
                      src={imageToEdit || selectedImage?.imageUrl}
                      alt="To edit"
                      className="w-full h-40 object-contain"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-950/80 rounded text-[10px] text-purple-300">
                      Base image selected
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-900/40 text-center cursor-pointer transition-all space-y-1"
                  >
                    <Upload className="w-6 h-6 mx-auto text-slate-500" />
                    <p className="text-xs text-slate-300 font-medium">Upload an image or pick below</p>
                  </div>
                )}

                {/* Thumbnail Picker from Gallery */}
                {images.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500">Pick from existing images:</span>
                    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                      {images.slice(0, 5).map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            setImageToEdit(img.imageUrl);
                            setSelectedImage(img);
                          }}
                          className={`w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0 transition-all ${
                            (imageToEdit === img.imageUrl || (!imageToEdit && selectedImage?.id === img.id))
                              ? "border-purple-500 ring-2 ring-purple-500/30"
                              : "border-slate-800 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Edit Instruction */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Edit Instruction</span>
                  <span className="text-[10px] text-purple-400 font-normal">
                    Gemini Multimodal Editing
                  </span>
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="What would you like to change? (e.g. Add glowing sunglasses, change background to a tropical beach, make it look like a vintage painting)..."
                  rows={3}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all"
                  disabled={isGenerating}
                />
              </div>

              {/* Quick Edit Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Quick Edit Ideas:</span>
                <div className="space-y-1">
                  {EDIT_PRESETS.slice(0, 3).map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditPrompt(preset)}
                      className="w-full text-left p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 hover:text-white transition-all truncate"
                    >
                      ✨ {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !editPrompt.trim() || (!imageToEdit && !selectedImage)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isGenerating ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin" />
                    <span>Applying Edits...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Apply Image Edit</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Side: Selected Image & Gallery */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950/50 p-4 sm:p-6 space-y-6">
          {selectedImage ? (
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {selectedImage.isEdited && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        Edited Image
                      </span>
                    )}
                    <span className="text-xs text-slate-400 capitalize">
                      {selectedImage.style}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">{selectedImage.createdAt}</span>
                  </div>
                  <p className="text-sm font-semibold text-white line-clamp-1">
                    {selectedImage.prompt}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyPrompt(selectedImage.id, selectedImage.prompt)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
                    title="Copy Prompt"
                  >
                    {copiedId === selectedImage.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Copy Prompt</span>
                  </button>

                  <button
                    onClick={() => {
                      setImageToEdit(selectedImage.imageUrl);
                      setStudioMode("edit");
                    }}
                    className="py-2 px-3 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Edit this Image</span>
                  </button>

                  <button
                    onClick={() => handleDownload(selectedImage)}
                    className="py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(selectedImage)}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
                    >
                      Chat
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteImage(selectedImage.id)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all"
                    title="Delete Image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Image View (With Side-by-Side if edited) */}
              <div className="w-full bg-slate-950 flex flex-col sm:flex-row items-center justify-center p-4 gap-4">
                {selectedImage.isEdited && selectedImage.originalImageUrl && (
                  <div className="flex-1 flex flex-col items-center gap-1.5 max-w-sm">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Original
                    </span>
                    <img
                      src={selectedImage.originalImageUrl}
                      alt="Original"
                      className="rounded-xl shadow-lg max-h-80 object-contain border border-slate-800"
                    />
                  </div>
                )}

                <div className="flex-1 flex flex-col items-center gap-1.5 max-w-md">
                  {selectedImage.isEdited && (
                    <span className="text-[11px] font-semibold text-pink-400 uppercase tracking-wider">
                      Edited Result
                    </span>
                  )}
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.prompt}
                    className="rounded-xl shadow-2xl max-h-96 object-contain border border-slate-800"
                  />
                </div>
              </div>

              {/* Description Footer */}
              <div className="p-4 bg-slate-900/60 border-t border-slate-800/80 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Description: </span>
                {selectedImage.textDescription || selectedImage.prompt}
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                No Image Selected
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                Create a new image with text prompts or upload an existing image to edit and transform with Gemini.
              </p>
            </div>
          )}

          {/* Gallery Grid */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>Saved Artwork Gallery</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {images.length}
              </span>
            </h3>

            {images.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No images created yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className={`cursor-pointer rounded-xl overflow-hidden border transition-all ${
                      selectedImage?.id === img.id
                        ? "border-purple-500 ring-2 ring-purple-500/20 bg-slate-900"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="aspect-square bg-slate-950 overflow-hidden relative group">
                      <img
                        src={img.imageUrl}
                        alt={img.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {img.isEdited && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-pink-950/80 border border-pink-500/40 text-[9px] font-semibold text-pink-300">
                          Edited
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      <p className="text-xs font-medium text-slate-200 truncate">{img.prompt}</p>
                      <p className="text-[10px] text-slate-500">{img.createdAt}</p>
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
