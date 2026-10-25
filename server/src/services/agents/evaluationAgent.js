import { average, clamp } from "../../utils/http.js";
import { aiProvider, callJson } from "../llm.js";
import { communicationScore } from "./communicationAgent.js";

const SYSTEM = `You are the Evaluation and Career Coach agent for InterviewIQ.
Evaluate the full interview transcript and coding submission.
Use only evidence from the transcript, resume profile, and code. Do not invent achievements.
Be specific and actionable. Scores range 0-100: 0-39 weak, 40-59 needs improvement, 60-74 acceptable, 75-89 strong, 90-100 excellent.`;

const TECHNICAL_ROUNDS = ["Resume", "Technical", "Project", "Stress"];
const BEHAVIORAL_ROUNDS = ["Introduction", "Behavioral", "Stress", "Closing"];

export function overallScore({ technical, communication, coding, behavioral, consistency }) {
  return clamp(technical * 0.35 + communication * 0.2 + coding * 0.2 + behavioral * 0.15 + consistency * 0.1);
}

export function scoreBand(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Acceptable";
  if (score >= 40) return "Needs improvement";
  return "Weak";
}

const turnScore = (e) => average([e.correctness, e.depth, e.clarity, e.confidence]) * 10;
const technicalTurnScore = (e) => average([e.correctness, e.depth]) * 10;

function stddev(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((v) => (v - mean) ** 2)));
}

function heuristicScores({ profile, turns }) {
  const answered = turns.filter((turn) => turn.answerTranscript && turn.internalEvaluation);
  const tech = answered.filter((turn) => TECHNICAL_ROUNDS.includes(turn.round));
  const behav = answered.filter((turn) => BEHAVIORAL_ROUNDS.includes(turn.round));
  const technical = clamp(tech.length ? average(tech.map((t) => technicalTurnScore(t.internalEvaluation))) : answered.length ? average(answered.map((t) => technicalTurnScore(t.internalEvaluation))) : 0);
  const behavioral = clamp(behav.length ? average(behav.map((t) => average([t.internalEvaluation.clarity, t.internalEvaluation.confidence, t.internalEvaluation.depth]) * 10)) : technical);
  const allText = answered.map((turn) => turn.answerTranscript.toLowerCase()).join(" ");

  const technicalSkills = (profile.skills || []).filter((skill) => skill.category !== "soft_skill").slice(0, 6);
  const technicalScores = technicalSkills.map(({ name }) => {
    const key = name.toLowerCase();
    const relevant = tech.filter((turn) => `${turn.question} ${turn.answerTranscript}`.toLowerCase().includes(key));
    return { skill: name, score: clamp(relevant.length ? average(relevant.map((t) => technicalTurnScore(t.internalEvaluation))) : technical - 6) };
  });

  const keywordBoost = (pattern) => (pattern.test(allText) ? 8 : -4);
  const behavioralScores = {
    teamwork: clamp(behavioral + keywordBoost(/\bteam|collaborat|together|peer/)),
    leadership: clamp(behavioral + keywordBoost(/\bled\b|lead|mentor|initiative|organi[sz]ed/)),
    problemSolving: clamp(average([behavioral, technical]) + keywordBoost(/debug|solv|approach|root cause|optimi[sz]/)),
    ownership: clamp(behavioral + keywordBoost(/\bowned|ownership|responsib|took charge|i decided|i built/))
  };
  return { technical, behavioral, technicalScores, behavioralScores };
}

const AREA_ACTIONS = {
  Technical: (skill) => [`Revise core ${skill} concepts and common interview questions`, `Explain one ${skill} concept aloud daily in under 2 minutes`, `Build a small feature using ${skill} and note the tradeoffs`],
  Coding: () => ["Solve 2 array/hash-map problems daily", "State time and space complexity before coding", "Practice writing edge-case tests first"],
  Communication: () => ["Answer in a clear structure: context, approach, result", "Record yourself and cut filler words", "Keep answers between 60 and 120 seconds"],
  Behavioral: () => ["Prepare 5 STAR stories (conflict, failure, ownership, leadership, impact)", "Quantify the result of each story", "Practice concise 90-second deliveries"]
};

function heuristicCoaching({ scores, communication, coding, technicalScores }) {
  const areas = [
    { area: "Technical", score: scores.technical },
    { area: "Communication", score: communication },
    { area: "Coding", score: coding },
    { area: "Behavioral", score: scores.behavioral }
  ].sort((a, b) => a.score - b.score);

  const weakestSkill = [...technicalScores].sort((a, b) => a.score - b.score)[0]?.skill || "fundamentals";
  const strongestSkill = [...technicalScores].sort((a, b) => b.score - a.score)[0];

  const strengths = areas.filter((a) => a.score >= 70).reverse().map((a) => `${a.area} performance was ${scoreBand(a.score).toLowerCase()} (${a.score}/100)`);
  if (strongestSkill && strongestSkill.score >= 65) strengths.push(`Solid understanding of ${strongestSkill.skill}`);
  if (!strengths.length) strengths.push(`Best area was ${areas.at(-1).area.toLowerCase()} (${areas.at(-1).score}/100)`);

  const weaknesses = areas.filter((a) => a.score < 70).map((a) => `${a.area} needs work (${a.score}/100)`);
  if (!weaknesses.length) weaknesses.push(`${areas[0].area} is the relative weak spot`);

  const roadmap = areas.slice(0, 3).map((a, index) => ({
    area: a.area === "Technical" ? weakestSkill : a.area,
    priority: index === 0 ? "High" : "Medium",
    actions: AREA_ACTIONS[a.area](weakestSkill),
    estimatedDays: a.score < 50 ? 10 : a.score < 70 ? 7 : 4
  }));

  return {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendations: roadmap.map((item) => item.actions[0]),
    roadmap
  };
}

const FEEDBACK_TIPS = {
  Introduction: "Open with your current role or degree, your core stack, and one achievement that matches the target role, in under 90 seconds.",
  Resume: "Back each claim with one concrete example: what you built, the tools you used, and a measurable result.",
  Technical: "Define the concept, explain how it works under the hood, then give a real example and its tradeoffs.",
  Project: "Walk through the problem, your architecture, a key tradeoff you made, and the measurable outcome.",
  Behavioral: "Use STAR: situation, task, the specific actions you took, and the result with numbers.",
  Stress: "Stay calm and structured: stabilize first, communicate status, find the root cause, then prevent recurrence.",
  Closing: "Reflect honestly on one improvement and ask a thoughtful question about the team or role."
};

function heuristicQuestionAnalysis(turns) {
  return turns
    .filter((turn) => turn.answerTranscript)
    .map((turn) => {
      const e = turn.internalEvaluation || {};
      const score = clamp(turnScore({ correctness: e.correctness ?? 5, depth: e.depth ?? 5, clarity: e.clarity ?? 5, confidence: e.confidence ?? 5 }));
      return {
        round: turn.round,
        question: turn.question,
        answer: turn.answerTranscript,
        score,
        verdict: scoreBand(score),
        feedback: e.notes || "Answer recorded.",
        idealAnswer: FEEDBACK_TIPS[turn.round] || FEEDBACK_TIPS.Technical
      };
    });
}

function aiPrompt({ profile, turns, communication, codingSubmission, problem }) {
  const transcript = turns
    .filter((turn) => turn.answerTranscript)
    .map((turn, index) => `[${index + 1}] (${turn.round}) Q: ${turn.question}\nA: ${turn.answerTranscript}`)
    .join("\n\n");
  const coding = codingSubmission?.code
    ? `Problem: ${problem?.title}\nLanguage: ${codingSubmission.language}\nTests: ${codingSubmission.executionResult?.testCasesPassed ?? "?"}/${codingSubmission.executionResult?.totalTestCases ?? "?"}\nCode review: ${codingSubmission.aiEvaluation?.feedback || ""}`
    : "No coding solution was submitted.";

  return `Candidate profile: ${JSON.stringify({ targetRole: profile.targetRole, seniority: profile.seniority, skills: (profile.skills || []).map((s) => s.name).slice(0, 15) })}

Transcript:
${transcript || "(no answers)"}

Communication metrics (computed): ${JSON.stringify(communication)}
Coding: ${coding}

Return JSON:
{
  "technicalScore": 0-100,
  "behavioralScore": 0-100,
  "technicalScores": [{ "skill": "name from profile", "score": 0-100 }],  // 4-6 skills relevant to the interview
  "behavioralScores": { "teamwork": 0-100, "leadership": 0-100, "problemSolving": 0-100, "ownership": 0-100 },
  "strengths": ["3-4 specific strengths with evidence"],
  "weaknesses": ["3-4 specific weaknesses with evidence"],
  "recommendations": ["3-5 actionable recommendations"],
  "personalizedRoadmap": [{ "area": "", "priority": "High|Medium|Low", "actions": ["", ""], "estimatedDays": 1-30 }],
  "summary": "2-3 sentence overall assessment",
  "questionAnalysis": [{ "index": 1, "score": 0-100, "feedback": "1-2 sentences on what was good and what was missing in THIS answer", "idealAnswer": "2-3 sentence outline of a strong answer to this exact question" }]  // one entry per numbered transcript item
}`;
}

export async function evaluateInterview({ profile, turns, communication, codingSubmission, problem }) {
  const comm = communicationScore(communication);
  const coding = codingSubmission?.aiEvaluation?.correctness != null && codingSubmission.code
    ? clamp(average([codingSubmission.aiEvaluation.logic, codingSubmission.aiEvaluation.efficiency, codingSubmission.aiEvaluation.correctness, codingSubmission.aiEvaluation.readability]))
    : 0;

  const answered = turns.filter((turn) => turn.answerTranscript && turn.internalEvaluation);
  const turnScores = answered.map((turn) => turnScore(turn.internalEvaluation));
  const consistency = answered.length < 2 ? (answered.length ? 60 : 0) : clamp(100 - stddev(turnScores) * 2);

  const base = heuristicScores({ profile, turns });
  const ai = answered.length ? await callJson({ label: "evaluation-agent", system: SYSTEM, maxTokens: 5000, prompt: aiPrompt({ profile, turns, communication, codingSubmission, problem }) }) : null;

  const technical = clamp(ai?.technicalScore ?? base.technical);
  const behavioral = clamp(ai?.behavioralScore ?? base.behavioral);
  const technicalScores = Array.isArray(ai?.technicalScores) && ai.technicalScores.length
    ? ai.technicalScores.filter((s) => s?.skill).slice(0, 8).map((s) => ({ skill: String(s.skill), score: clamp(s.score) }))
    : base.technicalScores;
  const behavioralScores = ai?.behavioralScores
    ? Object.fromEntries(Object.entries(base.behavioralScores).map(([key, value]) => [key, clamp(ai.behavioralScores[key] ?? value)]))
    : base.behavioralScores;

  const overall = overallScore({ technical, communication: comm, coding, behavioral, consistency });
  const hiringReadiness = clamp(overall * 0.6 + technical * 0.2 + comm * 0.2);
  const coaching = heuristicCoaching({ scores: { technical, behavioral }, communication: comm, coding, technicalScores });

  const roadmap = Array.isArray(ai?.personalizedRoadmap) && ai.personalizedRoadmap.length
    ? ai.personalizedRoadmap.slice(0, 5).map((item) => ({
        area: String(item.area || "General"),
        priority: ["High", "Medium", "Low"].includes(item.priority) ? item.priority : "Medium",
        actions: (item.actions || []).map(String).slice(0, 4),
        estimatedDays: clamp(item.estimatedDays ?? 7, 1, 60)
      }))
    : coaching.roadmap;

  const strings = (value, fallback) => (Array.isArray(value) && value.length ? value.map(String).slice(0, 5) : fallback);

  // Merge Gemini's per-question feedback onto the heuristic baseline so every answer gets an entry.
  const aiByIndex = new Map((Array.isArray(ai?.questionAnalysis) ? ai.questionAnalysis : []).map((item) => [Number(item.index), item]));
  const questionAnalysis = heuristicQuestionAnalysis(turns).map((item, i) => {
    const fromAi = aiByIndex.get(i + 1);
    if (!fromAi) return item;
    const score = clamp(fromAi.score ?? item.score);
    return { ...item, score, verdict: scoreBand(score), feedback: String(fromAi.feedback || item.feedback), idealAnswer: String(fromAi.idealAnswer || item.idealAnswer) };
  });

  return {
    overallScore: overall,
    hiringReadinessScore: hiringReadiness,
    placementReadiness: Math.round(hiringReadiness) / 10,
    technicalScore: technical,
    behavioralScore: behavioral,
    communicationScore: comm,
    codingScore: coding,
    consistencyScore: consistency,
    technicalScores,
    behavioralScores,
    communicationScores: {
      clarity: communication.clarity,
      confidence: communication.confidence,
      structure: communication.structure,
      pace: communication.pace,
      fillers: communication.fillers,
      fillerWordRate: communication.fillerWordRate,
      speakingPace: communication.speakingPace
    },
    codingScores: codingSubmission?.aiEvaluation
      ? {
          logic: codingSubmission.aiEvaluation.logic,
          efficiency: codingSubmission.aiEvaluation.efficiency,
          correctness: codingSubmission.aiEvaluation.correctness,
          readability: codingSubmission.aiEvaluation.readability
        }
      : { logic: 0, efficiency: 0, correctness: 0, readability: 0 },
    strengths: strings(ai?.strengths, coaching.strengths),
    weaknesses: strings(ai?.weaknesses, coaching.weaknesses),
    recommendations: strings(ai?.recommendations, coaching.recommendations),
    personalizedRoadmap: roadmap,
    questionAnalysis,
    summary:
      typeof ai?.summary === "string" && ai.summary
        ? ai.summary
        : `Overall performance was ${scoreBand(overall).toLowerCase()} at ${overall}/100. ${coaching.strengths[0]}. Focus next on ${roadmap[0]?.area || "fundamentals"}.`,
    generatedBy: ai ? aiProvider : "heuristic",
    rawAiOutput: ai
  };
}
