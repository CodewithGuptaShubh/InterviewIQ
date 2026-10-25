// Shape database documents into the payloads the React frontend renders.
import { CLOSING_MESSAGE } from "../data/questionBank.js";

const capitalize = (value = "") => value.charAt(0).toUpperCase() + value.slice(1);

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase() || "U";
}

export function formatDate(date) {
  return date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

export function formatDuration(seconds) {
  if (!seconds) return "—";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    title: user.title || "",
    plan: capitalize(user.plan),
    credits: user.credits,
    freeInterviewsUsed: user.freeInterviewsUsed,
    avatar: initials(user.name),
    avatarUrl: user.avatarUrl || null,
    preferences: user.preferences || [],
    hasPassword: Boolean(user.passwordHash)
  };
}

export function serializeProfile(profile, latestReport) {
  if (!profile) return null;
  const readiness = latestReport?.hiringReadinessScore ?? profile.readinessEstimate ?? 50;
  return {
    id: profile._id.toString(),
    resumeId: profile.resumeId?.toString() || null,
    fileName: profile.resumeFileName || "",
    targetRole: profile.targetRole || "Software Engineer",
    seniority: profile.seniority,
    difficulty: capitalize(profile.difficulty),
    readiness,
    placementReadiness: latestReport?.placementReadiness ?? Math.round(readiness) / 10,
    skills: (profile.skills || []).map((skill) => skill.name),
    skillDetails: profile.skills || [],
    strengths: profile.strengths || [],
    gaps: profile.gaps || [],
    projects: (profile.projects || []).map((project) => ({
      title: project.title,
      description: project.description || "",
      stack: (project.technologies || []).join(", "),
      impact: project.impact || project.description || ""
    })),
    experience: profile.experience || [],
    education: profile.education || [],
    certifications: profile.certifications || [],
    resumeScore: profile.resumeScore ?? null,
    suggestions: profile.suggestions || [],
    generatedBy: profile.generatedBy || "heuristic",
    updatedAt: profile.updatedAt
  };
}

export function serializeInterviewSummary(interview, report) {
  return {
    id: interview._id.toString(),
    role: interview.targetRole || interview.title,
    date: formatDate(interview.completedAt || interview.startedAt || interview.createdAt),
    score: report?.overallScore ?? null,
    status: capitalize(interview.status.replace("_", " ")),
    duration: formatDuration(interview.durationSeconds),
    hasReport: Boolean(report)
  };
}

export function serializeTurns(turns) {
  const transcript = [];
  for (const turn of turns) {
    transcript.push({ speaker: "ai", text: turn.question, round: turn.round });
    if (turn.answerTranscript) transcript.push({ speaker: "user", text: turn.answerTranscript, round: turn.round });
  }
  return transcript;
}

export function interviewProgress(interview) {
  const total = interview.roadmap.length || 1;
  const done = interview.roadmap.filter((round) => round.completed).length;
  return Math.round((done / total) * 100);
}

export function serializeInterview(interview, turns = []) {
  return {
    id: interview._id.toString(),
    title: interview.title,
    targetRole: interview.targetRole,
    difficulty: capitalize(interview.difficulty),
    status: interview.status,
    mode: interview.mode,
    currentRound: interview.currentRound,
    conversationDone: interview.conversationDone,
    roadmap: interview.roadmap.map((round) => ({
      round: round.round,
      goal: round.goal,
      completed: round.completed,
      current: round.round === interview.currentRound && !round.completed
    })),
    progress: interviewProgress(interview),
    startedAt: interview.startedAt,
    transcript: [...serializeTurns(turns), ...(interview.conversationDone ? [{ speaker: "ai", text: CLOSING_MESSAGE, round: "Closing" }] : [])]
  };
}

export function serializeReport(report, interview) {
  return {
    interview: serializeInterviewSummary(interview, report),
    overallScore: report.overallScore,
    hiringReadiness: report.hiringReadinessScore,
    placementReadiness: report.placementReadiness,
    scores: [
      { label: "Technical", value: report.technicalScore },
      { label: "Communication", value: report.communicationScore },
      { label: "Coding", value: report.codingScore },
      { label: "Behavioral", value: report.behavioralScore }
    ],
    technicalScores: report.technicalScores || [],
    behavioralScores: report.behavioralScores || {},
    codingScores: report.codingScores || {},
    communicationMetrics: communicationMetricsFrom(report),
    strengths: report.strengths || [],
    weaknesses: report.weaknesses || [],
    recommendations: report.recommendations || [],
    roadmap: (report.personalizedRoadmap || []).map((item) => ({
      area: item.area,
      priority: item.priority,
      actions: item.actions,
      days: item.estimatedDays
    })),
    questionAnalysis: report.questionAnalysis || [],
    summary: report.summary || "",
    generatedBy: report.generatedBy
  };
}

export function communicationMetricsFrom(report) {
  const scores = report?.communicationScores || {};
  return [
    { name: "Clarity", value: scores.clarity ?? 0 },
    { name: "Confidence", value: scores.confidence ?? 0 },
    { name: "Structure", value: scores.structure ?? 0 },
    { name: "Pace", value: scores.pace ?? 0 },
    { name: "Fillers", value: scores.fillers ?? 0 }
  ];
}
