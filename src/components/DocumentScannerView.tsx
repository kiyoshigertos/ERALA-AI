import React, { useState, useRef, useEffect } from "react";
import {
  FileScan,
  Upload,
  Camera,
  Check,
  Copy,
  CalendarPlus,
  Sparkles,
  Download,
  Languages,
  BookOpen,
  FileText,
  ListTodo,
  MessageSquare,
  Send,
  X,
  Trash2,
  Tag,
  AlertCircle,
  Eye,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import { DocumentScanResult, ScheduleItem } from "../types";
import { sounds } from "../utils/audio";

interface DocumentScannerViewProps {
  scannedDocs: DocumentScanResult[];
  onSaveDoc: (doc: DocumentScanResult) => void;
  onDeleteDoc: (id: string) => void;
  onAddScheduleItem: (item: Omit<ScheduleItem, "id" | "createdAt" | "completed">) => void;
}

// Sample presets for 1-click testing
const SAMPLE_PRESETS: Array<{
  name: string;
  type: string;
  title: string;
  sampleText: string;
  badge: string;
}> = [
  {
    name: "Course Syllabus & Deadlines",
    type: "Academic Reviewer",
    title: "CS 301 - Distributed Systems & Cloud Architecture Syllabus",
    badge: "Syllabus",
    sampleText: `UNIVERSITY OF TECHNOLOGY - DEPARTMENT OF COMPUTER SCIENCE
CS 301: Distributed Systems & Cloud Architecture (Fall Semester 2026)
Instructor: Prof. Angela Ramos (a.ramos@unitech.edu) | Room 402, Science Hall

COURSE SCHEDULE & KEY MILESTONES:
1. Aug 28, 2026 - Milestone 1: Raft Consensus Protocol Implementation & Unit Tests (20% grade)
2. Sep 15, 2026 - Midterm Exam: Byzantine Fault Tolerance & RPC Fundamentals (25% grade)
3. Oct 12, 2026 - Milestone 2: Cloud Load Balancing & Distributed Cache Cluster (25% grade)
4. Nov 20, 2026 - Final Project Submission & Live Technical Defense (30% grade)

REQUIRED TEXTBOOKS & RESOURCES:
- Designing Data-Intensive Applications by Martin Kleppmann
- Distributed Systems: Principles and Paradigms (3rd Edition)

POLICIES:
Late submissions are penalized 10% per calendar day. Attendance in lab sessions is mandatory.`,
  },
  {
    name: "Equipment Tax Invoice",
    type: "Official Receipt",
    title: "Official Invoice - TechGear Solutions Inc. (INV-2026-8841)",
    badge: "Invoice",
    sampleText: `TECHGEAR SOLUTIONS INC.
VAT Reg. TIN: 009-842-115-000
142 Innovation Ave, Cyberzone, Taguig City, Philippines
Tel: (02) 8872-9100 | accounts@techgear.ph

OFFICIAL SALES INVOICE
Invoice No: INV-2026-8841
Date: August 14, 2026
Customer: Quantum Leap Design Studios
Payment Terms: Net 15 Days (Due Date: August 29, 2026)
Payment Method: Corporate Bank Transfer

ITEMS PURCHASED:
1. UltraSharp 27" 4K HDR USB-C Monitor (Model U2723QE) - Qty: 2 @ PHP 28,500.00 = PHP 57,000.00
2. Ergonomic Mechanical Keyboard Pro (Wireless Tri-mode) - Qty: 2 @ PHP 6,250.00 = PHP 12,500.00
3. CalDigit Thunderbolt 4 Docking Station Pro - Qty: 1 @ PHP 18,900.00 = PHP 18,900.00

Subtotal: PHP 88,400.00
12% VAT: PHP 10,608.00
Total Amount Payable: PHP 99,008.00

Thank you for your business! Please settle before August 29, 2026 to avoid penalty fees.`,
  },
  {
    name: "Client Software Agreement",
    type: "Legal Contract",
    title: "Software Engineering & Consulting Services Agreement (Scope of Work)",
    badge: "Contract",
    sampleText: `MASTER SERVICES AGREEMENT - STATEMENT OF WORK (SOW-04)
Effective Date: September 1, 2026
Between: Lumina Dynamics Corp ("Client") and Vertex AI Labs ("Provider")

SCOPE OF DELIVERABLES:
1. Sprint 1 Delivery (Due Sep 18, 2026): Responsive Web Dashboard & Real-Time Telemetry API Integration.
2. Sprint 2 Delivery (Due Oct 05, 2026): Predictive Machine Learning Pipelines & Firestore Database Sync.
3. Security Audit & Final Handover (Due Oct 25, 2026): Penetration testing report and full repository transfer.

TOTAL CONTRACT VALUE: $24,500.00 USD
- 40% Advance Payment on Signing: $9,800.00 (Due Sep 05, 2026)
- 30% Milestone 1 Acceptance: $7,350.00 (Due Sep 22, 2026)
- 30% Final Handover & Sign-off: $7,350.00 (Due Oct 30, 2026)

CONFIDENTIALITY & IP:
All intellectual property developed hereunder shall transfer exclusively to Lumina Dynamics Corp upon final payment.`,
  },
];

// Helper to determine accurate MIME type from file extension or file.type
function resolveMimeType(file: File): string {
  if (file.type && file.type !== "application/octet-stream" && file.type.trim() !== "") {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    default:
      return "image/jpeg";
  }
}

// Client-side image compressor/scaler for fast, reliable upload
async function optimizeImageForOcr(file: File): Promise<{ base64: string; mimeType: string }> {
  const mimeType = resolveMimeType(file);

  // If non-image (like PDF or text), read as Data URL directly
  if (!mimeType.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: reader.result as string, mimeType });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // For images, optimize size if larger than 2MB or high-res
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 2200;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.9);
            resolve({ base64: optimizedBase64, mimeType: "image/jpeg" });
            return;
          }
        }
        resolve({ base64: originalDataUrl, mimeType });
      };
      img.onerror = () => {
        resolve({ base64: originalDataUrl, mimeType });
      };
      img.src = originalDataUrl;
    };
    reader.onerror = () => {
      resolve({ base64: "", mimeType });
    };
    reader.readAsDataURL(file);
  });
}

export const DocumentScannerView: React.FC<DocumentScannerViewProps> = ({
  scannedDocs,
  onSaveDoc,
  onDeleteDoc,
  onAddScheduleItem,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentScanResult | null>(
    scannedDocs[0] || null
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState("Preparing document...");
  const [targetLang, setTargetLang] = useState("filipino");
  const [customQuery, setCustomQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "summary" | "ocr" | "actions" | "entities" | "translation" | "qa"
  >("summary");
  const [qaMessages, setQaMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [qaInput, setQaInput] = useState("");
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Sync selectedDoc when list updates or empty
  useEffect(() => {
    if (!selectedDoc && scannedDocs.length > 0) {
      setSelectedDoc(scannedDocs[0]);
    }
  }, [scannedDocs, selectedDoc]);

  // Global Clipboard Paste Listener (Ctrl+V / Cmd+V anywhere on view)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleIncomingFile(file);
            return;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [targetLang, customQuery]);

  // Process any incoming file (from click, drag-drop, or paste)
  const handleIncomingFile = async (file: File) => {
    setErrorMessage(null);
    setIsScanning(true);
    setScanStep(`Reading ${file.name}...`);

    try {
      const { base64, mimeType } = await optimizeImageForOcr(file);
      if (!base64) {
        throw new Error("Unable to read file content. Please try another file.");
      }
      await processDocumentScan(base64, mimeType, file.name);
    } catch (err: any) {
      console.error("File upload error:", err);
      setErrorMessage(err.message || "Failed to process document file.");
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleIncomingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleIncomingFile(files[0]);
    }
  };

  // Process Document Scan via Gemini
  const processDocumentScan = async (
    imageBase64: string,
    mimeType: string,
    fallbackTitle = "Scanned Document"
  ) => {
    setIsScanning(true);
    setErrorMessage(null);
    setScanStep("ELARA Optical Vision OCR & Intelligence analysis...");

    try {
      const res = await fetch("/api/scan-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          targetLanguage: targetLang,
          customInstruction: customQuery.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setScanStep("Structuring action items and summary...");
        const parsed = data.data;
        const newDoc: DocumentScanResult = {
          id: Math.random().toString(36).substring(2, 9),
          title: parsed.title || fallbackTitle,
          documentType: parsed.documentType || "Document",
          language: parsed.language || "Auto-detected",
          rawText: parsed.rawText || "No text detected.",
          executiveSummary: parsed.executiveSummary || "Document processed successfully.",
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
          actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          translatedSummary: parsed.translatedSummary || "",
          confidenceScore: parsed.confidenceScore || 96,
          previewImage: imageBase64.startsWith("data:image") ? imageBase64 : undefined,
          timestamp: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        onSaveDoc(newDoc);
        setSelectedDoc(newDoc);
        setQaMessages([
          {
            role: "assistant",
            text: `Document scanned successfully: **${newDoc.title}**! You can ask me any questions about its content, summarize it, or extract tasks.`,
          },
        ]);
        sounds.playChime("complete");
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      } else {
        throw new Error(data.error || "No data received from document scanner.");
      }
    } catch (err: any) {
      console.error("Document scan error:", err);
      setErrorMessage(
        err.message || "Failed to analyze document. Please check the file and try again."
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Load Preset Sample Document
  const handleLoadSample = (sample: typeof SAMPLE_PRESETS[0]) => {
    const textBase64 = "data:text/plain;base64," + btoa(unescape(encodeURIComponent(sample.sampleText)));
    processDocumentScan(textBase64, "text/plain", sample.title);
  };

  // Camera Open / Capture
  const openCamera = async () => {
    setIsCameraOpen(true);
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.warn("Camera failed:", err);
      setErrorMessage("Unable to access camera. Please allow camera permissions or upload a file directly.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.92);
      closeCamera();
      processDocumentScan(base64, "image/jpeg", `Camera Snap ${new Date().toLocaleTimeString()}`);
    }
  };

  const closeCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  // Document Q&A
  const handleSendQa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || isQaLoading || !selectedDoc) return;

    const userText = qaInput.trim();
    setQaInput("");
    setQaMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsQaLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `DOCUMENT CONTENT:
"""
${selectedDoc.rawText}
"""

USER QUESTION ABOUT THIS DOCUMENT:
"${userText}"

Provide an accurate, clear answer based strictly on the document text above in English or the user's preferred language.`,
        }),
      });

      const data = await res.json();
      setQaMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.text || "No information found in the document regarding this question." },
      ]);
    } catch (err) {
      setQaMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, an error occurred while answering." },
      ]);
    } finally {
      setIsQaLoading(false);
    }
  };

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddActionToSchedule = (action: {
    task: string;
    dueDate?: string;
    priority?: any;
  }) => {
    const today = new Date().toISOString().split("T")[0];
    onAddScheduleItem({
      title: action.task,
      date: action.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(action.dueDate) ? action.dueDate : today,
      time: "09:00",
      priority: action.priority || "normal",
      category: "study",
      notes: `Extracted from document: "${selectedDoc?.title}"`,
      reminderMinutesBefore: 30,
    });
    sounds.playChime("complete");
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
  };

  const downloadReport = () => {
    if (!selectedDoc) return;
    const content = `# ${selectedDoc.title}
**Type:** ${selectedDoc.documentType} | **Confidence:** ${selectedDoc.confidenceScore}% | **Scanned:** ${selectedDoc.timestamp}

## Executive Summary
${selectedDoc.executiveSummary}

## Key Highlights & Points
${selectedDoc.keyPoints.map((p) => `- ${p}`).join("\n")}

## Actionable Items
${selectedDoc.actionItems.map((a) => `- [ ] ${a.task} (Due: ${a.dueDate || "N/A"}, Priority: ${a.priority || "Normal"})`).join("\n")}

## Key Entities Extracted
${selectedDoc.entities.map((e) => `- **${e.label}:** ${e.value}`).join("\n")}

## Multilingual Translation / Summary
${selectedDoc.translatedSummary}

## Raw OCR Extracted Text
\`\`\`
${selectedDoc.rawText}
\`\`\`

---
*Analyzed by ELARA AI Optical Document & Vision Scanner*
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedDoc.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_ELARA_Analysis.md`;
    link.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Drag & Drop Global Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-emerald-950/80 backdrop-blur-sm border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none animate-in fade-in duration-150">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 animate-bounce">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Drop Document Anywhere to Scan</h3>
          <p className="text-sm text-emerald-200">
            ELARA supports PDF, PNG, JPG, WebP, Text, and Markdown documents
          </p>
        </div>
      )}

      {/* Hidden Master File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md,.doc,.docx,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Banner */}
      <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileScan className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Document & Vision Scanner
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            OCR, intelligent summarization, action item extraction, and multilingual translation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Target Translation Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="filipino" className="bg-slate-900">Translate to Filipino</option>
              <option value="english" className="bg-slate-900">Translate to English</option>
              <option value="spanish" className="bg-slate-900">Translate to Spanish</option>
              <option value="japanese" className="bg-slate-900">Translate to Japanese</option>
            </select>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors shadow-sm active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload Document</span>
          </button>

          <button
            onClick={openCamera}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan with Camera</span>
          </button>
        </div>
      </div>

      {/* Error Message Toast / Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/80 border-b border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-3 px-4 sm:px-6 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="underline font-semibold hover:text-white"
            >
              Try Again
            </button>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-rose-900/50 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Document History List */}
        <div className="w-full md:w-80 bg-slate-950/80 border-r border-slate-800/80 p-4 overflow-y-auto space-y-3 flex-shrink-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Scanned Documents ({scannedDocs.length})</span>
            {scannedDocs.length > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>+ Scan New</span>
              </button>
            )}
          </div>

          {scannedDocs.length === 0 ? (
            <div className="p-5 text-center border border-dashed border-slate-800 rounded-2xl space-y-3 bg-slate-900/20">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <p className="text-xs text-slate-300 font-medium">No documents scanned yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Upload an image, PDF, or sample note to see intelligent OCR in action.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Browse Files</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {scannedDocs.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                      isSelected
                        ? "bg-slate-900 border-emerald-500/80 shadow-sm"
                        : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {doc.previewImage ? (
                        <img
                          src={doc.previewImage}
                          alt="Doc"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <FileText className="w-5 h-5 text-emerald-400" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-semibold text-slate-200 truncate">
                          {doc.title}
                        </h4>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="text-emerald-400 font-medium">{doc.documentType}</span>
                          <span>•</span>
                          <span>{doc.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDoc(doc.id);
                        if (selectedDoc?.id === doc.id) {
                          setSelectedDoc(scannedDocs.find((d) => d.id !== doc.id) || null);
                        }
                      }}
                      className="p-1 rounded-lg text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Doc"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Preset Samples in Sidebar */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Test Samples</span>
            </div>
            <div className="space-y-1.5">
              {SAMPLE_PRESETS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadSample(sample)}
                  disabled={isScanning}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                >
                  <span className="truncate group-hover:text-emerald-300">{sample.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium flex-shrink-0">
                    {sample.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Active Document Analysis Inspector or Empty Dropzone */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {isScanning ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h3 className="font-bold text-slate-100 text-base">
                  ELARA is Analyzing Document...
                </h3>
                <p className="text-xs text-emerald-400 font-mono animate-pulse">
                  {scanStep}
                </p>
                <p className="text-xs text-slate-400 pt-1">
                  Extracting OCR transcription, executive summary, deadlines, entities, and translations.
                </p>
              </div>
            </div>
          ) : !selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-lg p-8 sm:p-10 rounded-3xl border-2 border-dashed border-slate-800 hover:border-emerald-500/80 bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer flex flex-col items-center text-center space-y-4 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-100 text-base sm:text-lg group-hover:text-emerald-300 transition-colors">
                    Click to Upload or Drag & Drop Document Here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    Upload handwritten notes, course reviewers, contracts, receipts, PDFs, or photos for instant AI extraction.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap justify-center">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">PDF</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">PNG</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">JPG / JPEG</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">WebP</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">TXT / MD</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">Paste (Ctrl+V)</span>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    Select File from Device
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCamera();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Camera Scan</span>
                  </button>
                </div>
              </div>

              {/* Sample Document Quick Try Section */}
              <div className="mt-8 w-full max-w-lg space-y-3">
                <div className="text-center text-xs font-semibold text-slate-400">
                  Or test immediately with a ready-to-scan sample:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SAMPLE_PRESETS.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadSample(sample)}
                      className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 text-left transition-all space-y-1.5 cursor-pointer group"
                    >
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        {sample.badge}
                      </div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                        {sample.name}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-2">
                        {sample.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Document Header & Actions */}
              <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {selectedDoc.previewImage ? (
                    <button
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="relative group cursor-pointer"
                      title="Click to view original image"
                    >
                      <img
                        src={selectedDoc.previewImage}
                        alt="Thumbnail"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-700 group-hover:border-emerald-400 transition-colors"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-white" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{selectedDoc.title}</h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="text-emerald-400 font-medium">
                        {selectedDoc.documentType}
                      </span>
                      <span>•</span>
                      <span>Confidence: {selectedDoc.confidenceScore}%</span>
                      <span>•</span>
                      <span>Language: {selectedDoc.language}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors cursor-pointer"
                    title="Upload another document"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload New</span>
                  </button>

                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report (.md)</span>
                  </button>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
                {[
                  { id: "summary", label: "Executive Summary", icon: BookOpen },
                  { id: "ocr", label: "Raw OCR Text", icon: FileText },
                  { id: "actions", label: `Action Items (${selectedDoc.actionItems.length})`, icon: ListTodo },
                  { id: "entities", label: `Key Entities (${selectedDoc.entities.length})`, icon: Tag },
                  { id: "translation", label: "Multilingual Translation", icon: Languages },
                  { id: "qa", label: "Document Q&A", icon: MessageSquare },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* 1. Executive Summary */}
                {activeTab === "summary" && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Sparkles className="w-4 h-4" />
                          Executive Summary
                        </span>
                        <button
                          onClick={() => handleCopy("summary", selectedDoc.executiveSummary)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === "summary" ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedField === "summary" ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {selectedDoc.executiveSummary}
                      </p>
                    </div>

                    {selectedDoc.keyPoints.length > 0 && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                          Key Highlights & Important Points
                        </h4>
                        <ul className="space-y-2 text-sm text-slate-300">
                          {selectedDoc.keyPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Raw OCR Text */}
                {activeTab === "ocr" && (
                  <div className="space-y-3 max-w-3xl">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Exact extracted OCR transcription from document</span>
                      <button
                        onClick={() => handleCopy("rawText", selectedDoc.rawText)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                      >
                        {copiedField === "rawText" ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedField === "rawText" ? "Copied!" : "Copy OCR Text"}</span>
                      </button>
                    </div>
                    <pre className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto select-text">
                      {selectedDoc.rawText}
                    </pre>
                  </div>
                )}

                {/* 3. Action Items */}
                {activeTab === "actions" && (
                  <div className="space-y-3 max-w-3xl">
                    <div className="text-xs text-slate-400">
                      Actionable tasks and obligations detected in this document:
                    </div>
                    {selectedDoc.actionItems.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                        No direct action items or pending tasks detected in this document.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDoc.actionItems.map((action, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {action.task}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                {action.dueDate && <span>📅 Due: {action.dueDate}</span>}
                                {action.priority && (
                                  <span className="capitalize text-amber-400">
                                    • {action.priority} priority
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleAddActionToSchedule(action)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              <span>Add to Schedule</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Entities */}
                {activeTab === "entities" && (
                  <div className="space-y-3 max-w-3xl">
                    <div className="text-xs text-slate-400">
                      Extracted dates, names, amounts, reference numbers, or institutions:
                    </div>
                    {selectedDoc.entities.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                        No structured entity tags detected in this document.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedDoc.entities.map((ent, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-2"
                          >
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                                {ent.label}
                              </span>
                              <span className="text-sm font-medium text-slate-200 block mt-0.5 select-text">
                                {ent.value}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCopy(`ent-${idx}`, ent.value)}
                              className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Translation */}
                {activeTab === "translation" && (
                  <div className="space-y-3 max-w-3xl">
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Languages className="w-4 h-4" />
                          Multilingual Translation / Pagsasalin
                        </span>
                        <button
                          onClick={() =>
                            handleCopy("trans", selectedDoc.translatedSummary || "")
                          }
                          className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {selectedDoc.translatedSummary || "No translation available."}
                      </p>
                    </div>
                  </div>
                )}

                {/* 6. Document Q&A */}
                {activeTab === "qa" && (
                  <div className="space-y-4 max-w-3xl flex flex-col h-full min-h-[350px]">
                    <div className="flex-1 space-y-3 overflow-y-auto">
                      {qaMessages.map((m, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                            m.role === "assistant"
                              ? "bg-slate-900 border border-slate-800 text-slate-200"
                              : "bg-emerald-600 text-white ml-auto"
                          }`}
                        >
                          {m.text}
                        </div>
                      ))}
                      {isQaLoading && (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2 max-w-xs">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                          <span>ELARA is analyzing the document...</span>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendQa} className="flex gap-2">
                      <input
                        type="text"
                        value={qaInput}
                        onChange={(e) => setQaInput(e.target.value)}
                        placeholder="Ask anything about this document (e.g. 'What is the total amount due?')..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={!qaInput.trim() || isQaLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Original Image Modal */}
      {isPreviewModalOpen && selectedDoc?.previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col space-y-3 max-h-[90vh]">
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <FileScan className="w-4 h-4 text-emerald-400" />
                <span>Original Document Preview: {selectedDoc.title}</span>
              </h3>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
              <img
                src={selectedDoc.previewImage}
                alt="Original Document"
                className="max-h-[70vh] object-contain rounded-lg shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Camera Live Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center space-y-3">
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                Document Scanner Camera
              </h3>
              <button
                onClick={closeCamera}
                className="text-slate-400 hover:text-white"
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
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={closeCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Capture & Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
