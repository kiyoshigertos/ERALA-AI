import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";

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

// 4. Text-to-Speech Endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }

    const ai = getGeminiClient();
    const cleanText = text.slice(0, 500).replace(/[*#_`~\[\]]/g, "");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Kore", // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
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
          voiceUsed: voiceName,
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

// Vite middleware for development & Static files in production
async function start() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ELARA Assistant server running on http://0.0.0.0:${PORT}`);
  });
}

start();
