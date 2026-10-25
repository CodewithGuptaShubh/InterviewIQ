import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { speechProvider, synthesize, transcribe } from "../services/speech.js";
import { HttpError, parseBody } from "../utils/http.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

function requireGemini() {
  if (speechProvider !== "gemini") throw new HttpError(501, "Server speech is not configured; using browser speech instead");
}

router.post("/tts", async (req, res) => {
  requireGemini();
  const { text } = parseBody(z.object({ text: z.string().trim().min(1).max(1500) }), req.body);
  try {
    const wav = await synthesize(text);
    res.set({ "Content-Type": "audio/wav", "Cache-Control": "no-store" }).send(wav);
  } catch (error) {
    if (error.quota) throw new HttpError(429, "Gemini voice quota reached for today; using browser voice");
    console.warn("[tts] Gemini TTS failed:", error.message);
    throw new HttpError(502, "Text-to-speech failed");
  }
});

router.post("/stt", upload.single("audio"), async (req, res) => {
  requireGemini();
  if (!req.file) throw new HttpError(400, "Attach an audio file in the 'audio' field");
  try {
    res.json({ text: await transcribe(req.file.buffer, req.file.mimetype) });
  } catch (error) {
    if (error.status) throw error;
    if (error.quota) throw new HttpError(429, "Gemini transcription quota reached for today");
    console.warn("[stt] Gemini transcription failed:", error.message);
    throw new HttpError(502, "Gemini transcription failed");
  }
});

export default router;
