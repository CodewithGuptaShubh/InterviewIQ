import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be set in production");
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 8080,
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((url) => url.trim()).filter(Boolean),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_ACCESS_SECRET || "dev-only-insecure-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  // "low" | "medium" | "high" for Gemini 3+ models; empty uses the model default (much slower).
  geminiThinkingLevel: process.env.GEMINI_THINKING_LEVEL ?? "low",
  // Transcription uses a separate (lite) model so it has its own free-tier quota and doesn't starve question generation.
  geminiSttModel: process.env.GEMINI_STT_MODEL || "gemini-3.1-flash-lite",
  geminiTtsModel: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts",
  geminiTtsVoice: process.env.GEMINI_TTS_VOICE || "Kore",
  interviewPriceInr: Number(process.env.INTERVIEW_PRICE_INR) || 50,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  freeInterviewLimit: Number(process.env.FREE_INTERVIEW_LIMIT ?? 2)
};
