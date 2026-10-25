import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import { candidateText, geminiGenerate } from "./llm.js";

export const speechProvider = env.geminiKey ? "gemini" : "browser";

const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/flac", "audio/aac", "audio/aiff", "audio/webm"];

/** Speech-to-text: transcribe an answer verbatim, keeping filler words for communication analysis. */
export async function transcribe(buffer, mimeType) {
  const type = mimeType.split(";")[0].toLowerCase();
  if (!AUDIO_TYPES.includes(type)) throw new HttpError(400, `Unsupported audio type: ${mimeType}`);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe this interview answer verbatim in English. Keep filler words exactly as spoken (um, uh, like, you know). Do not summarize, correct grammar, or add commentary. If there is no speech, return an empty string. Return only the transcript."
          },
          { inlineData: { mimeType: type === "audio/x-wav" ? "audio/wav" : type, data: buffer.toString("base64") } }
        ]
      }
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 4096 }
  };

  // Try the dedicated transcription model first, then the main model (each has its own quota).
  let lastError;
  for (const model of [...new Set([env.geminiSttModel, env.geminiModel])]) {
    try {
      return candidateText(await geminiGenerate(model, body)).trim().replace(/^"|"$/g, "");
    } catch (error) {
      lastError = error;
      if (!error.quota) console.warn(`[stt] ${model} failed: ${error.message}`);
    }
  }
  throw lastError;
}

function pcmToWav(pcm, sampleRate, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Text-to-speech: returns a WAV buffer of the interviewer reading `text`. */
export async function synthesize(text) {
  const candidate = await geminiGenerate(
    env.geminiTtsModel,
    {
      // Send only the words to speak: this model reads any style instruction aloud.
      contents: [{ role: "user", parts: [{ text: text.slice(0, 1500) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env.geminiTtsVoice } } }
      }
    },
    60000
  );

  const audio = candidate.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!audio) throw new Error("Gemini TTS returned no audio");
  // Gemini returns raw 16-bit PCM, e.g. "audio/L16;codec=pcm;rate=24000".
  const rate = Number(audio.mimeType?.match(/rate=(\d+)/)?.[1]) || 24000;
  const pcm = Buffer.from(audio.data, "base64");
  return audio.mimeType?.includes("wav") ? pcm : pcmToWav(pcm, rate);
}
