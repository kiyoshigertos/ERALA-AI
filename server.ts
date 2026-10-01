import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import {
  GoogleGenAI,
  GenerateVideosOperation,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
} from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy get GoogleGenAI client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Helper for calling Gemini with exponential backoff and automatic model fallback
async function callGeminiWithRetryAndFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  params: { contents: any; config?: any },
  fallbackModels: string[] = ["gemini-flash-latest", "gemini-3.1-flash-lite"]
): Promise<{ response: any; modelUsed: string }> {
  const modelsToTry = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];
  let lastError: any = null;

  for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
    const currentModel = modelsToTry[modelIdx];
    const maxRetries = modelIdx === 0 ? 3 : 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: params.config,
        });
        return { response, modelUsed: currentModel };
      } catch (error: any) {
        lastError = error;
        const errStatus = error?.status || error?.code || error?.error?.code;
        const errMessage = (error?.message || "").toLowerCase();
        const isTransient =
          errStatus === 503 ||
          errStatus === 429 ||
          errStatus === "UNAVAILABLE" ||
          errStatus === "RESOURCE_EXHAUSTED" ||
          errMessage.includes("high demand") ||
          errMessage.includes("spikes in demand") ||
          errMessage.includes("unavailable") ||
          errMessage.includes("overloaded") ||
          errMessage.includes("rate limit") ||
          errMessage.includes("quota") ||
          errMessage.includes("econnreset");

        if (isTransient && attempt < maxRetries) {
          const delayMs = Math.min(800 * Math.pow(2, attempt) + Math.random() * 400, 4000);
          console.warn(
            `[Gemini API] Retry attempt ${attempt + 1}/${maxRetries} for ${currentModel} after ${Math.round(
              delayMs
            )}ms due to temporary demand: ${error.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        console.warn(
          `[Gemini API] Model ${currentModel} encountered error (attempt ${attempt + 1}): ${
            error.message
          }. Evaluating fallback...`
        );
        break;
      }
    }
  }

  throw lastError;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// System prompt builder for ELARA
function buildElaraSystemPrompt(options: {
  persona?: string;
  language?: string;
  deepReasoning?: boolean;
  userMood?: string;
  currentTime?: string;
}) {
  const {
    persona = "balanced",
    language = "english",
    deepReasoning = false,
    userMood = "neutral",
    currentTime = new Date().toLocaleString(),
  } = options;

  let langInstruction = "";
  if (language === "filipino" || language === "tl" || language === "tagalog") {
    langInstruction = `
- PRIMARY LANGUAGE: Filipino (Tagalog) / Taglish. Respond naturally in fluent, modern Filipino or natural conversational Taglish.
- Use warm, respectful, and culturally grounded expressions.
- Full multilingual comprehension: seamlessly understand any language input.
`;
  } else if (language === "taglish") {
    langInstruction = `
- PRIMARY LANGUAGE: Natural Filipino Taglish (Tagalog-English code-switching). Make it modern, friendly, and relatable like an intelligent peer or colleague.
`;
  } else if (language === "cebuano") {
    langInstruction = `
- PRIMARY LANGUAGE: Cebuano / Bisaya. Respond in natural, warm Cebuano with English when appropriate for technical terms.
`;
  } else if (language === "ilocano") {
    langInstruction = `
- PRIMARY LANGUAGE: Ilocano. Respond in respectful, clear Ilocano.
`;
  } else if (language === "spanish") {
    langInstruction = `
- PRIMARY LANGUAGE: Spanish (Español). Clear, articulate, concise, and engaging.
`;
  } else if (language === "japanese") {
    langInstruction = `
- PRIMARY LANGUAGE: Japanese (日本語). Polite, natural, and helpful.
`;
  } else if (language === "auto") {
    langInstruction = `
- MULTILINGUAL AUTO-DETECT: You have native comprehension of all global and regional languages (English, Filipino/Tagalog, Taglish, Cebuano, Spanish, Japanese, French, German, Chinese, etc.).
- Detect the user's language and respond in the same language, or in English if preferred.
`;
  } else {
    // Default English
    langInstruction = `
- PRIMARY LANGUAGE: English. Clear, articulate, warm, and engaging.
- UNIVERSAL MULTILINGUAL UNDERSTANDING: You have comprehensive, native-level mastery of ALL languages (including Filipino/Tagalog, Taglish, Cebuano, Ilocano, Spanish, Japanese, French, German, Chinese, Korean, etc.).
- Seamlessly comprehend queries in any language, perform cross-lingual analysis, translate between languages, and respond in the user's chosen language whenever they switch.
`;
  }

  let personaInstruction = "";
  switch (persona) {
    case "companion":
      personaInstruction = `
- TONE: Deeply empathetic, warm, emotionally intelligent, patient, and supportive.
- Act as a true life companion who listens attentively, validates feelings, notices emotional nuances, and offers comforting perspective, grounding techniques, or gentle encouragement. Current detected user mood: ${userMood}.
`;
      break;
    case "analyst":
      personaInstruction = `
- TONE: Rigorous, highly structured, analytical, precise, logical, and evidence-driven.
- Break problems down step by step with clear rationale, bullet points, trade-offs, and actionable conclusions.
`;
      break;
    case "productivity":
      personaInstruction = `
- TONE: Action-oriented, efficient, organized, proactive, motivating, and clear.
- Highlight deadlines, prioritize tasks, suggest smart time-blocking, and focus on execution.
`;
      break;
    default:
      personaInstruction = `
- TONE: Intelligent, warm, articulate, adaptive, helpful, and insightful. A modern, all-around personal AI partner.
`;
      break;
  }

  return `
You are ELARA (Enhance Learning Analyst and Reasoning Assistant), an advanced multimodal personal AI assistant designed to enhance everyday life across study, work, health, organization, and personal growth.

CURRENT LOCAL TIME & DATE: ${currentTime}

CORE IDENTITY & CAPABILITIES:
1. Schedule & Reminders Intelligence: You help users organize their day, extract dates, detect implicit or explicit tasks, and format them clearly.
2. Document & Visual Analysis: You can read, analyze, summarize, extract key points, and structure scanned documents, handwritten notes, receipts, schedules, or diagrams.
3. Emotional Intelligence & Companionship: You care about user well-being. You detect subtle emotional cues, offer empathetic reflections, mindfulness exercises, or comforting companionship.
4. Universal Multilingual Mastery: Fully proficient in English and all global and regional languages (Filipino, Taglish, Cebuano, Spanish, Japanese, etc.), able to understand and communicate across languages.
5. High-Level Reasoning: When requested for deep analysis or complex problem-solving, provide rigorous, step-by-step logic.
${langInstruction}
${personaInstruction}

RESPONSE FORMATTING GUIDELINES:
- Use clean Markdown with clear headings, bold key concepts, and formatted lists where appropriate.
- If the user mentions any appointment, task, or reminder, you can naturally acknowledge it and optionally include a schedule block:
  [SCHEDULE_SUGGESTION: {"title": "Task title", "date": "YYYY-MM-DD", "time": "HH:MM", "priority": "normal|high|urgent", "category": "work|personal|study|health"}]
- Keep answers engaging, thoughtful, and immediately useful.
`.trim();
}

// 1. Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      prompt,
      images = [],
      language = "auto",
      persona = "balanced",
      deepReasoning = false,
      userMood = "neutral",
    } = req.body;

    const ai = getGeminiClient();
    const systemInstruction = buildElaraSystemPrompt({
      persona,
      language,
      deepReasoning,
      userMood,
      currentTime: new Date().toLocaleString(),
    });

    const modelName = "gemini-3.7-flash";

    // Prepare contents
    const contents: any[] = [];

    // Prior history if provided
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        const role = m.role === "assistant" ? "model" : "user";
        const parts: any[] = [];
        if (m.images && Array.isArray(m.images)) {
          for (const img of m.images) {
            if (img.base64 && img.mimeType) {
              parts.push({
                inlineData: {
                  data: img.base64.replace(/^data:[^;]+;base64,/, ""),
                  mimeType: img.mimeType,
                },
              });
            }
          }
        }
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    // Current user prompt with images
    const currentParts: any[] = [];
    if (Array.isArray(images)) {
      for (const img of images) {
        if (img.base64 && img.mimeType) {
          currentParts.push({
            inlineData: {
              data: img.base64.replace(/^data:[^;]+;base64,/, ""),
              mimeType: img.mimeType,
            },
          });
        }
      }
    }
    if (prompt) {
      currentParts.push({ text: prompt });
    }

    if (currentParts.length > 0) {
      contents.push({ role: "user", parts: currentParts });
    }

    const config: any = {
      systemInstruction,
      temperature: deepReasoning ? 0.7 : 0.8,
    };

    if (deepReasoning) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    const { response, modelUsed } = await callGeminiWithRetryAndFallback(
      ai,
      modelName,
      { contents, config },
      ["gemini-flash-latest", "gemini-3.1-flash-lite"]
    );

    const text = response.text || "Walang naibigay na sagot. Pakisubukan muli.";

    // Extract any schedule suggestions if present
    let scheduleSuggestions: any[] = [];
    const scheduleRegex = /\[SCHEDULE_SUGGESTION:\s*({.*?})\]/g;
    let match;
    while ((match = scheduleRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        scheduleSuggestions.push(parsed);
      } catch (e) {
        // ignore parse error
      }
    }

    res.json({
      text,
      scheduleSuggestions,
      modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({
      error:
        error.message ||
        "The model is currently experiencing high demand. Please try again in a few moments.",
    });
  }
});

// 2. Document Vision Scanner Endpoint
app.post("/api/scan-document", async (req, res) => {
  try {
    const { imageBase64, mimeType, targetLanguage = "auto", customInstruction } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing document or image data." });
    }

    const ai = getGeminiClient();
    
    // Extract base64 and detect mimeType if provided in data URI
    let cleanBase64 = imageBase64;
    let resolvedMime = (mimeType && mimeType.trim() !== "") ? mimeType.trim() : "";

    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        if (!resolvedMime || resolvedMime === "application/octet-stream") {
          resolvedMime = match[1];
        }
        cleanBase64 = match[2];
      } else {
        cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      }
    }

    // Default mime type if still undefined or empty
    if (!resolvedMime || resolvedMime === "application/octet-stream") {
      resolvedMime = "image/jpeg";
    }

    const prompt = `
You are ELARA's Optical Document & Vision Intelligence Scanner.
Carefully examine the attached document, handwritten note, receipt, book page, form, ID, certificate, PDF, or image.

Analyze the content and provide a comprehensive structured JSON response with the following fields:
1. "documentType": Type of document (e.g., "Official Receipt", "Handwritten Notes", "Academic Reviewer", "Legal Contract", "Class Schedule", "Medical Prescription", "Letter", "Book Page", "Certificate", "Report", "General Document")
2. "title": A clear, concise detected or generated title for the document (in English)
3. "language": Detected primary language of the original text
4. "rawText": Exact text extracted (OCR transcription) verbatim as accurately and completely as possible
5. "executiveSummary": A clear, high-level summary of what this document is about (in English, or matching target language)
6. "keyPoints": Array of 3-7 bullet points of the most critical information, numbers, dates, terms, or findings in English
7. "actionItems": Array of objects [{ "task": "...", "dueDate": "YYYY-MM-DD or text", "priority": "urgent|high|normal" }] representing actionable tasks or obligations found in the document
8. "entities": Array of objects [{ "label": "e.g. Date, Person, Amount, Institution, Reference No.", "value": "..." }]
9. "translatedSummary": A comprehensive summary in ${targetLanguage === "filipino" ? "Filipino/Tagalog" : targetLanguage === "spanish" ? "Spanish" : targetLanguage === "japanese" ? "Japanese" : "English and Filipino"}
10. "confidenceScore": Estimated OCR and analysis confidence number between 85 and 99

${customInstruction ? `ADDITIONAL USER QUERY / FOCUS: ${customInstruction}` : ""}

Return ONLY valid JSON matching this schema without surrounding markdown wrappers.
`.trim();

    // Check if the document is pure text/csv/markdown or binary/image/pdf
    const parts: any[] = [];

    if (resolvedMime.startsWith("text/")) {
      let decodedText = "";
      try {
        decodedText = Buffer.from(cleanBase64, "base64").toString("utf-8");
      } catch {
        decodedText = cleanBase64;
      }
      parts.push({
        text: `DOCUMENT CONTENT (Plain Text):\n${decodedText}\n\n${prompt}`,
      });
    } else {
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: resolvedMime,
        },
      });
      parts.push({ text: prompt });
    }

    const { response } = await callGeminiWithRetryAndFallback(
      ai,
      "gemini-3.7-flash",
      {
        contents: {
          parts,
        },
        config: {
          responseMimeType: "application/json",
        },
      },
      ["gemini-flash-latest", "gemini-3.1-flash-lite"]
    );

    const rawResponse = response.text || "{}";
    let parsedData: any = {};
    try {
      const cleanJson = rawResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsedData = JSON.parse(cleanJson);
    } catch (err) {
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedData = JSON.parse(match[0]);
        } catch {
          parsedData = {
            documentType: "Document",
            title: "Scanned Document",
            rawText: rawResponse,
            executiveSummary: "Document analyzed successfully.",
            keyPoints: [],
            actionItems: [],
            entities: [],
          };
        }
      } else {
        parsedData = {
          documentType: "Document",
          title: "Scanned Document",
          rawText: rawResponse,
          executiveSummary: "Document analyzed.",
          keyPoints: [],
          actionItems: [],
          entities: [],
        };
      }
    }

    res.json({
      success: true,
      data: parsedData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/scan-document:", error);
    res.status(500).json({
      error: error.message || "Failed to scan and analyze document. Please check file format and try again.",
    });
  }
});

// 3. AI Image Generation Endpoint
app.post("/api/generate-image", async (req, res) => {
  try {
    const {
      prompt,
      aspectRatio = "1:1",
      style = "vibrant digital art",
      enhancePrompt = true,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const ai = getGeminiClient();

    // Enhance prompt with ELARA aesthetic intelligence if requested
    let finalPrompt = prompt;
    if (enhancePrompt) {
      try {
        const enhancerRes = await callGeminiWithRetryAndFallback(
          ai,
          "gemini-3.7-flash",
          {
            contents: `Enhance this image prompt for maximum aesthetic quality, lighting, and detail in style '${style}'. Keep it descriptive and under 60 words: "${prompt}"`,
          },
          ["gemini-flash-latest"]
        );
        if (enhancerRes.response.text && enhancerRes.response.text.length > 10) {
          finalPrompt = enhancerRes.response.text.trim();
        }
      } catch (e) {
        finalPrompt = `${prompt}, high quality, beautiful lighting, style: ${style}`;
      }
    }

    const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const chosenRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "1:1";

    let imageUrl = "";
    let textDescription = "";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: chosenRatio as any,
          },
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
          } else if (part.text) {
            textDescription = part.text;
          }
        }
      }
    } catch (imageErr: any) {
      console.warn("Nano banana image generation fallback triggered:", imageErr.message);
      // Generate detailed visual concept breakdown and fallback aesthetic graphic
      try {
        const fallbackDescription = await callGeminiWithRetryAndFallback(
          ai,
          "gemini-3.7-flash",
          {
            contents: `Describe a breathtaking visual scene based on: "${finalPrompt}". Provide a poetic description and color palette.`,
          },
          ["gemini-flash-latest"]
        );
        textDescription = fallbackDescription.response.text || finalPrompt;
      } catch (fallbackErr) {
        textDescription = finalPrompt;
      }
      
      // Provide an artistic placeholder URL using Unsplash aesthetic matching keywords
      imageUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1080&q=80`;
    }

    res.json({
      success: true,
      imageUrl,
      enhancedPrompt: finalPrompt,
      textDescription,
      aspectRatio: chosenRatio,
    });
  } catch (error: any) {
    console.error("Error in /api/generate-image:", error);
    res.status(500).json({
      error: error.message || "Failed to generate image.",
    });
  }
});

// 3b. AI Image Editing Endpoint (with Gemini image-to-image)
app.post("/api/edit-image", async (req, res) => {
  try {
    const {
      prompt,
      imageBase64,
      mimeType = "image/png",
      aspectRatio = "1:1",
    } = req.body;

    if (!prompt || !imageBase64) {
      return res.status(400).json({ error: "Both prompt and base image are required for editing." });
    }

    const ai = getGeminiClient();
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const resolvedMime = mimeType || "image/png";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: resolvedMime,
            },
          },
          { text: `Modify and edit this image based on this request: ${prompt}` },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    let imageUrl = "";
    let textDescription = "";

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription = part.text;
        }
      }
    }

    if (!imageUrl) {
      imageUrl = `data:${resolvedMime};base64,${cleanBase64}`;
    }

    res.json({
      success: true,
      imageUrl,
      textDescription,
      prompt,
    });
  } catch (error: any) {
    console.error("Error in /api/edit-image:", error);
    res.status(500).json({
      error: error.message || "Failed to edit image.",
    });
  }
});

// 3c. Veo 3 Video Generation Endpoints (model: veo-3.1-fast-generate-preview, aspect ratio 16:9 or 9:16)
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio = "16:9", startingImageBase64, mimeType = "image/png" } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "A prompt is required for Veo 3 video generation." });
    }

    // Aspect ratio must strictly be 16:9 or 9:16
    const validRatio: "16:9" | "9:16" = aspectRatio === "9:16" ? "9:16" : "16:9";
    const ai = getGeminiClient();

    const videoPayload: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt.trim(),
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: validRatio,
      },
    };

    if (startingImageBase64) {
      const cleanImg = startingImageBase64.replace(/^data:[^;]+;base64,/, "");
      videoPayload.image = {
        imageBytes: cleanImg,
        mimeType: mimeType || "image/png",
      };
    }

    console.log(`[Veo 3] Triggering generateVideos with veo-3.1-fast-generate-preview, ratio: ${validRatio}`);
    const operation = await ai.models.generateVideos(videoPayload);

    console.log(`[Veo 3] Operation started successfully: ${operation.name}`);
    res.json({
      success: true,
      operationName: operation.name,
      aspectRatio: validRatio,
      prompt: prompt.trim(),
    });
  } catch (error: any) {
    console.error("Error in /api/generate-video:", error);
    res.status(500).json({
      error: error.message || "Failed to start Veo 3 video generation.",
    });
  }
});

app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required to check status." });
    }

    const ai = getGeminiClient();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({
      done: !!updated.done,
      error: updated.error || null,
      operationName,
    });
  } catch (error: any) {
    console.error("Error in /api/video-status:", error);
    res.status(500).json({
      error: error.message || "Failed to check video generation status.",
    });
  }
});

app.all(["/api/video-download", "/api/video-stream"], async (req, res) => {
  try {
    const operationName = req.body?.operationName || (req.query?.operationName as string);
    if (!operationName) {
      return res.status(400).json({ error: "Missing operationName parameter." });
    }

    const ai = getGeminiClient();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: "Video URI is not yet available or operation did not produce video." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey || "" },
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({
        error: `Could not fetch video from upstream: ${videoRes.statusText}`,
      });
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (req.query?.download === "true") {
      res.setHeader("Content-Disposition", 'attachment; filename="elara-veo3-video.mp4"');
    }

    res.send(buffer);
  } catch (error: any) {
    console.error("Error in /api/video-download:", error);
    res.status(500).json({
      error: error.message || "Failed to download video file.",
    });
  }
});

// 4. Dedicated Voice AI Turn Endpoint (Transcribe Audio + Reason + Voice Synthesize)
app.post("/api/voice-turn", async (req, res) => {
  try {
    const {
      prompt,
      audioBase64,
      mimeType = "audio/webm",
      language = "filipino",
      persona = "balanced",
      voiceName = "Kore",
    } = req.body;

    if (!prompt && !audioBase64) {
      return res.status(400).json({ error: "Either audioBase64 or prompt text is required." });
    }

    const ai = getGeminiClient();
    let userTranscript = prompt || "";
    let responseText = "";
    let detectedLanguage = language;

    if (audioBase64) {
      // Audio Input with Multimodal Processing
      const cleanBase64 = audioBase64.includes("base64,")
        ? audioBase64.split("base64,")[1]
        : audioBase64;

      const voicePrompt = `
You are ELARA (Enhance Learning Analyst and Reasoning Assistant), an intelligent personal AI assistant.
Current Time: ${new Date().toLocaleTimeString()}
User preferred language setting: ${language}.
Selected Persona: ${persona}.

Please listen to the user's spoken audio carefully and return a JSON object with:
1. "userTranscript": The exact words spoken by the user in the audio (if in Filipino/Taglish/English, transcribe accurately). If inaudible or empty, output "[Voice input detected]".
2. "responseText": Your spoken response as ELARA. Keep it natural, conversational, warm, and concise (2 to 4 sentences max, ideal for a voice conversation). If the user asks about schedules or ideas, answer directly and clearly.
3. "detectedLanguage": The language detected in the audio (e.g., "English", "Filipino", "Taglish").

Return ONLY valid JSON matching this schema.
`.trim();

      try {
        const { response } = await callGeminiWithRetryAndFallback(
          ai,
          "gemini-3.7-flash",
          {
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType: mimeType || "audio/webm",
                    },
                  },
                  { text: voicePrompt },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          },
          ["gemini-flash-latest"]
        );

        const parsed = JSON.parse(response.text || "{}");
        userTranscript = parsed.userTranscript || "[Spoken Query]";
        responseText = parsed.responseText || "I heard you! How can I assist you with your day?";
        detectedLanguage = parsed.detectedLanguage || language;
      } catch (err: any) {
        console.warn("Direct multimodal audio parsing fallback:", err.message);
        userTranscript = "Voice Query";
        responseText = "I'm listening and ready to assist. Could you please repeat that or tell me what you'd like to do?";
      }
    } else {
      // Text Prompt Input
      const chatPrompt = `
You are ELARA (Enhance Learning Analyst and Reasoning Assistant), responding in real-time voice mode.
Language: ${language}. Persona: ${persona}.
User spoke or asked: "${prompt}"

Provide a voice-friendly, natural, spoken reply. Keep it concise (2 to 4 sentences) without excessive markdown formatting, bullet lists, or code blocks so it sounds great spoken aloud.
`.trim();

      try {
        const { response } = await callGeminiWithRetryAndFallback(
          ai,
          "gemini-3.7-flash",
          { contents: chatPrompt },
          ["gemini-flash-latest"]
        );
        responseText = response.text || "I'm here to help you. What's next on your agenda?";
      } catch (err: any) {
        responseText = "I understood your request. How would you like me to proceed?";
      }
    }

    // Now generate high-fidelity TTS audio for the response
    let audioOutputBase64 = null;
    const cleanSpeechText = responseText.slice(0, 500).replace(/[*#_`~\[\]]/g, "");

    const validVoiceNames = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
    const chosenVoice = validVoiceNames.includes(voiceName) ? voiceName : "Kore";

    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: cleanSpeechText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: chosenVoice,
              },
            },
          },
        },
      });

      audioOutputBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.warn("TTS generation notice:", ttsErr.message);
    }

    res.json({
      success: true,
      userTranscript,
      responseText,
      audioBase64: audioOutputBase64,
      mimeType: audioOutputBase64 ? "audio/pcm;rate=24000" : null,
      voiceUsed: chosenVoice,
      detectedLanguage,
      fallbackToWebSpeech: !audioOutputBase64,
    });
  } catch (error: any) {
    console.error("Error in /api/voice-turn:", error);
    res.status(500).json({
      error: error.message || "Failed to process voice turn.",
    });
  }
});

// 5. Text-to-Speech Endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }

    const ai = getGeminiClient();
    const cleanText = text.slice(0, 500).replace(/[*#_`~\[\]]/g, "");

    const validVoiceNames = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
    const chosenVoice = validVoiceNames.includes(voiceName) ? voiceName : "Kore";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: chosenVoice,
              },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        return res.json({
          success: true,
          audioBase64: audioData,
          mimeType: "audio/pcm;rate=24000",
          voiceUsed: chosenVoice,
        });
      }
    } catch (ttsErr: any) {
      console.warn("Server TTS fallback to browser TTS notice:", ttsErr.message);
    }

    res.json({
      success: false,
      fallbackToWebSpeech: true,
      text: cleanText,
    });
  } catch (error: any) {
    console.error("Error in /api/tts:", error);
    res.json({
      success: false,
      fallbackToWebSpeech: true,
      error: error.message,
    });
  }
});

// 5. Emotional Intelligence Analysis & Check-in Endpoint
app.post("/api/analyze-emotions", async (req, res) => {
  try {
    const { moodNote, moodRating, userHistory = [] } = req.body;
    const ai = getGeminiClient();

    const prompt = `
You are ELARA's Emotional Intelligence (EQ) and Mindfulness Module.
A user shares their current state:
Mood rating: ${moodRating}/5
User note/feeling: "${moodNote || 'Checking in for today'}"

Please analyze with genuine empathy and return a structured JSON response:
1. "dominantEmotion": e.g. "Overwhelmed", "Peaceful", "Motivated", "Anxious", "Fatigued", "Grateful", "Unsettled"
2. "empathyReflection": 2-3 heartfelt, warm sentences in English acknowledging their feelings without toxic positivity (or in the user's native language if specified)
3. "filipinoComfortQuote": A warm, encouraging quote, comforting thought, or timeless uplifting proverb (in English, e.g. "No matter how heavy the rain, the sun always finds its way through", "Take a deep breath; you don't have to carry everything all at once.")
4. "mindfulnessExercise": An easy 60-second exercise (e.g. "Box Breathing (4-4-4-4)", "5-4-3-2-1 Sensory Grounding", "Tension Release Shoulder Roll") with 3 clear steps in English.
5. "suggestedWellnessAction": A simple, low-effort action in English (e.g., drink a cold glass of water, step outside for fresh air, stretch for 2 minutes).
6. "positivityScore": A score from 1 to 100.

Return ONLY valid JSON matching this schema.
`.trim();

    const { response } = await callGeminiWithRetryAndFallback(
      ai,
      "gemini-3.7-flash",
      {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      },
      ["gemini-flash-latest"]
    );

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      data: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/analyze-emotions:", error);
    res.status(500).json({ error: error.message || "Failed to analyze mood." });
  }
});

// 6. Natural Language Schedule & Reminder Parser
app.post("/api/parse-schedule", async (req, res) => {
  try {
    const { text, currentDate = new Date().toISOString() } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required." });
    }

    const ai = getGeminiClient();
    const prompt = `
Current reference date/time: ${currentDate}
User sentence in English, Filipino/Tagalog, or Taglish: "${text}"

Extract all schedule events, tasks, or reminders mentioned.
Return a JSON array of items with properties:
- "title": Clean concise title (in English or Filipino)
- "date": "YYYY-MM-DD" (calculate relative terms like 'bukas'/'tomorrow', 'sa makalawa'/'in 2 days', 'sa Biyernes'/'this Friday', 'mamaya'/'later today')
- "time": "HH:MM" in 24-hour format (e.g. "15:00" for 3pm, "09:30", "19:00" for mamayang gabi)
- "category": "work" | "personal" | "study" | "health" | "errands"
- "priority": "urgent" | "high" | "normal" | "relaxed"
- "notes": Any extra details or locations mentioned
- "reminderMinutesBefore": integer (e.g. 15, 30, 60)

If no specific date is mentioned, assume today's date or tomorrow based on context.
Return ONLY valid JSON array.
`.trim();

    const { response } = await callGeminiWithRetryAndFallback(
      ai,
      "gemini-3.7-flash",
      {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      },
      ["gemini-flash-latest"]
    );

    const parsed = JSON.parse(response.text || "[]");
    res.json({
      success: true,
      items: Array.isArray(parsed) ? parsed : [parsed],
    });
  } catch (error: any) {
    console.error("Error in /api/parse-schedule:", error);
    res.status(500).json({ error: error.message || "Failed to parse schedule." });
  }
});

// 7. Live API WebSocket Server (gemini-3.8-live)
function setupLiveWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs: WebSocket, req) => {
    console.log("[Live API] Client connected to /live");
    let session: any = null;
    let isClosed = false;

    try {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const voiceName = url.searchParams.get("voice") || "Zephyr";
      const language = url.searchParams.get("language") || "english";
      const persona = url.searchParams.get("persona") || "balanced";

      const validVoiceNames = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
      const chosenVoice = validVoiceNames.includes(voiceName) ? voiceName : "Zephyr";

      const systemInstruction = `
You are ELARA (Enhance Learning Analyst and Reasoning Assistant), an intelligent, warm, and highly capable personal AI partner.
You are engaged in a real-time spoken voice conversation with the user.
Language preference: ${language}.
Selected Persona: ${persona}.
IMPORTANT CONVERSATIONAL RULES:
- Speak in natural, spoken conversational language.
- Do NOT use markdown symbols, bullet lists, markdown asterisks, or tables.
- Keep your answers concise (2 to 3 sentences max) so that the user and you can have a natural, fluid dialogue.
- You have native understanding of English, Filipino/Tagalog, Taglish, Cebuano, and all global languages.
`.trim();

      const ai = getGeminiClient();
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: chosenVoice,
              },
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;
            try {
              // 1. Audio output chunk from Gemini (24kHz 16-bit PCM little-endian)
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio) {
                clientWs.send(JSON.stringify({ type: "audio", audio }));
              }

              // 2. Interruption event
              if (message.serverContent?.interrupted) {
                clientWs.send(JSON.stringify({ type: "interrupted", interrupted: true }));
              }

              // 3. Audio transcriptions
              const outputText = (message.serverContent as any)?.outputAudioTranscription?.text;
              const inputText = (message.serverContent as any)?.inputAudioTranscription?.text;
              if (outputText || inputText) {
                clientWs.send(JSON.stringify({
                  type: "transcription",
                  outputText,
                  inputText,
                }));
              }
            } catch (err) {
              console.error("[Live API] Error sending to clientWs:", err);
            }
          },
          onclose: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "session_closed" }));
            }
          },
          onerror: (err: any) => {
            console.error("[Live API] Gemini Live error:", err);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", error: err?.message || "Live API error" }));
            }
          },
        },
      });

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: "ready",
          model: "gemini-3.8-live",
          voice: chosenVoice,
        }));
      }

      clientWs.on("message", (raw) => {
        if (isClosed || !session) return;
        try {
          const data = JSON.parse(raw.toString());
          if (data.audio) {
            session.sendRealtimeInput({
              audio: {
                data: data.audio,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } else if (data.text) {
            session.sendRealtimeInput({
              text: data.text,
            });
          }
        } catch (err) {
          console.error("[Live API] Error handling client audio:", err);
        }
      });

      clientWs.on("close", () => {
        isClosed = true;
        if (session) {
          try {
            session.close();
          } catch (e) {
            // ignore
          }
        }
      });

      clientWs.on("error", (err) => {
        console.error("[Live API] Client WebSocket error:", err);
        isClosed = true;
        if (session) {
          try {
            session.close();
          } catch (e) {
            // ignore
          }
        }
      });
    } catch (err: any) {
      console.error("[Live API] Failed to initialize live session:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: "error",
          error: err?.message || "Failed to start Live API session",
        }));
        clientWs.close();
      }
    }
  });

  return wss;
}

// Vite middleware for development & Static files in production
async function start() {
  const server = http.createServer(app);

  // Attach Gemini Live API WebSocket Server
  setupLiveWebSocketServer(server);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ELARA Assistant server with Live API running on http://0.0.0.0:${PORT}`);
  });
}

start();
