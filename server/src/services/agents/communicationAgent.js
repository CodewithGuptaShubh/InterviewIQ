import { average, clamp } from "../../utils/http.js";

const FILLERS = ["um", "umm", "uh", "uhh", "er", "ah", "like", "actually", "basically", "literally", "you know", "i mean", "sort of", "kind of"];
const HEDGES = ["i think", "maybe", "probably", "i guess", "not sure", "i don't know", "perhaps", "might be", "i believe"];
const STRUCTURE = ["first", "second", "then", "next", "finally", "because", "so that", "for example", "for instance", "as a result", "the result", "situation", "task", "action", "in summary", "overall", "tradeoff", "which meant"];

function countPhrases(text, phrases) {
  let count = 0;
  for (const phrase of phrases) {
    const matches = text.match(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
    count += matches ? matches.length : 0;
  }
  return count;
}

/** Score one answer on clarity, confidence, structure, pace and filler usage (each 0-100). */
export function analyzeAnswer(answer, durationSeconds) {
  const text = answer.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = answer.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentenceLength = wordCount / Math.max(1, sentences.length);

  const fillerCount = countPhrases(text, FILLERS);
  const hedgeCount = countPhrases(text, HEDGES);
  const structureHits = countPhrases(text, STRUCTURE);
  const fillerRate = wordCount ? fillerCount / wordCount : 0;

  // Pace is only meaningful for spoken/timed answers; typed answers get a neutral score.
  const wpm = durationSeconds && durationSeconds >= 5 ? Math.round(wordCount / (durationSeconds / 60)) : null;
  const pace = wpm == null || wpm > 400 ? 75 : wpm < 90 ? clamp(50 + (wpm - 60)) : wpm > 180 ? clamp(100 - (wpm - 180) / 2) : 92;

  const lengthScore = wordCount < 12 ? 35 : wordCount < 30 ? 60 : wordCount < 220 ? 90 : 70;
  const sentenceScore = avgSentenceLength > 35 ? 60 : avgSentenceLength < 5 ? 55 : 90;

  return {
    wordCount,
    wpm,
    fillerCount,
    fillerRate: Number(fillerRate.toFixed(3)),
    clarity: clamp(0.5 * lengthScore + 0.5 * sentenceScore - fillerRate * 300),
    confidence: clamp(88 - hedgeCount * 9 - fillerRate * 200 + (wordCount > 40 ? 6 : 0) - (wordCount < 12 ? 20 : 0)),
    structure: clamp(48 + structureHits * 10 + (sentences.length >= 3 ? 12 : 0) - (wordCount < 15 ? 15 : 0)),
    pace,
    fillers: clamp(100 - fillerRate * 800)
  };
}

/** Aggregate per-answer metrics into session-level communication scores. */
export function aggregateCommunication(metricsList) {
  const list = metricsList.filter(Boolean);
  if (!list.length) return { clarity: 0, confidence: 0, structure: 0, pace: 0, fillers: 0, fillerWordRate: 0, speakingPace: null, averageWords: 0 };
  const paced = list.map((m) => m.wpm).filter((wpm) => wpm != null);
  return {
    clarity: clamp(average(list.map((m) => m.clarity))),
    confidence: clamp(average(list.map((m) => m.confidence))),
    structure: clamp(average(list.map((m) => m.structure))),
    pace: clamp(average(list.map((m) => m.pace))),
    fillers: clamp(average(list.map((m) => m.fillers))),
    fillerWordRate: Number(average(list.map((m) => m.fillerRate)).toFixed(3)),
    speakingPace: paced.length ? Math.round(average(paced)) : null,
    averageWords: Math.round(average(list.map((m) => m.wordCount)))
  };
}

export function communicationScore(aggregate) {
  return clamp(average([aggregate.clarity, aggregate.confidence, aggregate.structure, aggregate.pace, aggregate.fillers]));
}
