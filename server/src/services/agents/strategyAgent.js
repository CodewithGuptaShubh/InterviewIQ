import { pickProblem } from "../../data/codingProblems.js";

// Conversational rounds are driven by the interviewer agent; "Coding" is completed via the editor.
const ROUND_PLANS = {
  beginner: [
    ["Introduction", "Warm up and understand the candidate's background", 1],
    ["Resume", "Verify skills and claims from the resume", 1],
    ["Technical", "Check core fundamentals for the target role", 2],
    ["Project", "Explore one project in depth", 1],
    ["Behavioral", "Assess teamwork and ownership with a STAR-style story", 1],
    ["Coding", "Solve one coding problem in the editor", 0],
    ["Closing", "Wrap up and invite candidate questions", 1]
  ],
  intermediate: [
    ["Introduction", "Warm up and understand the candidate's background", 1],
    ["Resume", "Verify skills and claims from the resume", 1],
    ["Technical", "Probe fundamentals and practical depth", 2],
    ["Project", "Deep-dive into architecture and tradeoffs of a project", 2],
    ["Behavioral", "Assess teamwork, conflict, and ownership", 1],
    ["Coding", "Solve one coding problem in the editor", 0],
    ["Closing", "Wrap up and invite candidate questions", 1]
  ],
  advanced: [
    ["Introduction", "Warm up and understand the candidate's background", 1],
    ["Resume", "Verify skills and impact claims", 1],
    ["Technical", "Probe advanced concepts and edge cases", 2],
    ["Project", "Deep-dive into architecture, scale, and tradeoffs", 2],
    ["Behavioral", "Assess leadership, conflict, and ownership", 1],
    ["Stress", "Handle a pressure scenario or production incident", 1],
    ["Coding", "Solve one coding problem in the editor", 0],
    ["Closing", "Wrap up and invite candidate questions", 1]
  ]
};

export function buildStrategy(profile) {
  const difficulty = profile.difficulty || "intermediate";
  const roadmap = ROUND_PLANS[difficulty].map(([round, goal, estimatedQuestions]) => ({ round, goal, estimatedQuestions, completed: false }));
  const problem = pickProblem(difficulty);
  const questionCount = roadmap.reduce((sum, round) => sum + round.estimatedQuestions, 0);
  return { difficulty, roadmap, problem, estimatedMinutes: questionCount * 3 + 15 };
}

/** The next conversational round after `current`, skipping the editor-driven Coding round. */
export function nextConversationRound(roadmap, current) {
  const index = roadmap.findIndex((round) => round.round === current);
  return roadmap.slice(index + 1).find((round) => round.round !== "Coding") || null;
}
