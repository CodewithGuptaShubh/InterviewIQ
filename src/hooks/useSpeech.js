import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { toWav } from "../lib/audio.js";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const canRecord = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

let providerPromise = null;

/** Which speech engine the server offers: "gemini" (server TTS/STT) or "browser". Null until known. */
export function useSpeechProvider() {
  const [provider, setProvider] = useState(null);
  useEffect(() => {
    providerPromise ||= api.health().then((health) => health.speech || "browser").catch(() => "browser");
    providerPromise.then(setProvider);
  }, []);
  return provider;
}

/**
 * Speech-to-text. With Gemini, records audio and transcribes it on stop; otherwise uses live browser recognition.
 * `onText(text, { final, durationSeconds })` receives the transcript of the current recording.
 */
export function useDictation(provider, onText) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const useGemini = provider === "gemini" && canRecord;
  const supported = useGemini || Boolean(Recognition);

  const startBrowser = useCallback(() => {
    const recognition = new Recognition();
    const startedAt = Date.now();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      onTextRef.current(text.trim(), { final: false, durationSeconds: (Date.now() - startedAt) / 1000 });
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const startGemini = useCallback(async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Microphone permission was denied");
      return;
    }

    // Live browser recognition runs alongside the recording: it shows text while speaking
    // and is the backup if Gemini transcription fails (e.g. daily quota reached).
    let backupText = "";
    const startedAt = Date.now();
    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        backupText = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
        onTextRef.current(backupText, { final: false, durationSeconds: (Date.now() - startedAt) / 1000 });
      };
      recognition.onerror = () => {};
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
      setListening(false);
      const fallbackSeconds = (Date.now() - startedAt) / 1000;
      if (!chunks.length) return;
      setTranscribing(true);
      try {
        const { wav, durationSeconds } = await toWav(new Blob(chunks, { type: recorder.mimeType }));
        const { text } = await api.transcribe(wav);
        if (text) onTextRef.current(text, { final: true, durationSeconds });
        else if (backupText) onTextRef.current(backupText, { final: true, durationSeconds });
        else setError("No speech detected, please try again");
      } catch (err) {
        if (backupText) {
          onTextRef.current(backupText, { final: true, durationSeconds: fallbackSeconds });
          setError(`${err.message || "Gemini transcription failed"}. Used browser transcription instead; please review it.`);
        } else {
          setError(`${err.message || "Transcription failed"}. Please try again or type your answer.`);
        }
      } finally {
        setTranscribing(false);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setListening(true);
  }, []);

  const start = useCallback(() => {
    setError("");
    if (useGemini) startGemini();
    else if (Recognition) startBrowser();
  }, [useGemini, startGemini, startBrowser]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else setListening(false);
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    },
    []
  );

  return { supported, listening, transcribing, error, start, stop, engine: useGemini ? "gemini" : "browser" };
}

let currentAudio = null;
// Incremented on every speak/stop so a slow TTS response can't start playing after it was cancelled.
let speechGeneration = 0;

function speakWithBrowser(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  window.speechSynthesis.speak(utterance);
}

/** Text-to-speech: Gemini voice when available, falling back to the browser voice. */
export async function speak(text, provider) {
  stopSpeaking();
  if (provider !== "gemini") return speakWithBrowser(text);
  const generation = speechGeneration;
  try {
    const blob = await api.speak(text);
    if (generation !== speechGeneration) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    currentAudio = audio;
    await audio.play();
  } catch {
    if (generation === speechGeneration) speakWithBrowser(text);
  }
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  speechGeneration++;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
