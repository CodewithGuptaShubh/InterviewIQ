import { env } from "../config/env.js";

export const aiProvider = env.geminiKey ? "gemini" : "heuristic";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

// Gemini 3+ text models reason at length by default (60s+ per call); a lower thinking level keeps the interview responsive.
const supportsThinkingLevel = (model) => /^gemini-([3-9]|\d{2,})/.test(model) && !/tts/.test(model);

// When a model reports an exhausted quota, skip it until the reset instead of spending requests on certain failures.
const blockedUntil = new Map();

export class GeminiQuotaError extends Error {
  constructor(model, retryAt) {
    super(`Gemini quota exhausted for ${model}; resets ${new Date(retryAt).toLocaleString()}`);
    this.quota = true;
    this.retryAt = retryAt;
  }
}

/** Parse "Please retry in 20h26m54.18s" / "retry in 45.2s" from a 429 message. */
function retryDelayMs(message = "") {
  const match = message.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (!match) return 60000;
  const [, h = 0, m = 0, s = 0] = match;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
}

/** Low-level generateContent call. Returns the first candidate. Retries once on overload or a short rate limit. */
export async function geminiGenerate(model, body, timeoutMs = 45000) {
  if (!env.geminiKey) throw new Error("GEMINI_API_KEY is not set");
  if ((blockedUntil.get(model) || 0) > Date.now()) throw new GeminiQuotaError(model, blockedUntil.get(model));

  const payload =
    supportsThinkingLevel(model) && env.geminiThinkingLevel
      ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: env.geminiThinkingLevel } } }
      : body;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (response.ok) {
      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error(`Gemini returned no candidates${data.promptFeedback?.blockReason ? ` (blocked: ${data.promptFeedback.blockReason})` : ""}`);
      return candidate;
    }

    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || response.statusText;
    if (response.status === 429) {
      const delay = retryDelayMs(message);
      // A long wait means a daily/plan quota: block the model rather than retrying.
      if (delay > 10000 || attempt > 0) {
        const retryAt = Date.now() + Math.min(delay, 24 * 3600 * 1000);
        blockedUntil.set(model, retryAt);
        console.warn(`[gemini] ${model} quota exhausted; falling back until ${new Date(retryAt).toLocaleString()}`);
        throw new GeminiQuotaError(model, retryAt);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (response.status === 503 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    throw new Error(`Gemini ${response.status}: ${message}`);
  }
}

export const candidateText = (candidate) =>
  (candidate.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || "").join("");

/**
 * Ask Gemini for a JSON object. `parts` lets callers attach inline data (e.g. audio) after the prompt.
 * Returns null when no key is configured or the call fails, so callers can fall back to heuristics.
 */
export async function callJson({ system, prompt, parts = [], maxTokens = 1500, label = "llm" }) {
  if (aiProvider === "heuristic") return null;
  try {
    const candidate = await geminiGenerate(env.geminiModel, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        // Gemini 2.5+ models spend part of this budget on internal reasoning, so leave generous headroom.
        maxOutputTokens: Math.max(4096, maxTokens * 4)
      }
    });
    const json = extractJson(candidateText(candidate));
    if (!json) console.warn(`[${label}] Gemini returned non-JSON output, using fallback`);
    return json;
  } catch (error) {
    // Quota errors are logged once when the model is blocked; skip the per-call noise.
    if (!error.quota) console.warn(`[${label}] Gemini call failed, using fallback:`, error.message);
    return null;
  }
}
