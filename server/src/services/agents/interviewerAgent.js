import { FOLLOW_UPS, ROUND_QUESTIONS, TOPIC_QUESTIONS } from "../../data/questionBank.js";
import { clamp } from "../../utils/http.js";
import { callJson } from "../llm.js";

const SYSTEM = `You are a professional technical interviewer conducting a realistic mock interview for InterviewIQ.
You must ask exactly one question at a time.
You adapt based on the candidate's previous answer:
- If the answer is shallow or vague, ask one probing follow-up.
- If the answer is strong, increase depth.
- If the answer is incorrect, ask a clarifying recovery question.
- If the candidate struggled twice on a topic, move on.
You must not repeat prior questions. Never fabricate resume details; only reference what is in the profile.
Ground questions in the candidate's actual resume: name their specific projects, technologies, and claims, and probe their listed gaps.
Use a project's suggestedQuestions as inspiration in the Project round, adapting them to the conversation.
Keep a professional, calm, human tone. Questions are 1-3 sentences; you may briefly acknowledge the previous answer first.
You silently evaluate each answer but never reveal scores or rubrics to the candidate.`;

function profileSummary(profile) {
  return JSON.stringify({
    targetRole: profile.targetRole,
    seniority: profile.seniority,
    difficulty: profile.difficulty,
    skills: (profile.skills || []).map((skill) => skill.name).slice(0, 20),
    projects: (profile.projects || []).map((project) => ({
      title: project.title,
      description: project.description,
      technologies: project.technologies,
      impact: project.impact,
      suggestedQuestions: project.questionsHint
    })),
    experience: profile.experience,
    strengths: profile.strengths,
    gaps: profile.gaps
  });
}

function transcriptText(turns) {
  return turns.map((turn, i) => `[${i + 1}] (${turn.round}) Interviewer: ${turn.question}\nCandidate: ${turn.answerTranscript ?? "(awaiting answer)"}`).join("\n\n");
}

// ---------- Heuristic fallback ----------

const firstName = (name = "") => name.trim().split(/\s+/)[0] || "there";

function fill(template, ctx) {
  return template.replace(/\{(\w+)\}/g, (_, key) => ctx[key] ?? "");
}

function heuristicContext(profile, userName, askedCount) {
  const technical = (profile.skills || []).filter((skill) => skill.category !== "soft_skill").map((skill) => skill.name);
  const skills = technical.length ? technical : ["software development", "problem solving"];
  const projects = profile.projects || [];
  const project = projects[askedCount % Math.max(1, projects.length)];
  return {
    name: firstName(userName),
    role: profile.targetRole || "software engineer",
    skill: skills[askedCount % skills.length],
    skill2: skills[(askedCount + 1) % skills.length],
    project: project?.title || "your most significant project",
    tech: project?.technologies?.[0] || skills[0],
    skills
  };
}

function heuristicQuestion(round, profile, turns, userName) {
  const asked = new Set(turns.map((turn) => turn.question));
  const ctx = heuristicContext(profile, userName, turns.length);
  const candidates = [];

  if (round === "Technical") {
    for (const skill of ctx.skills) candidates.push(...(TOPIC_QUESTIONS[skill] || []));
  }
  candidates.push(...(ROUND_QUESTIONS[round] || ROUND_QUESTIONS.Technical).map((template) => fill(template, ctx)));
  // Re-fill templates with other skills/projects so we rarely run out of fresh questions.
  for (let shift = 1; shift < 4; shift++) {
    candidates.push(...(ROUND_QUESTIONS[round] || []).map((template) => fill(template, heuristicContext(profile, userName, turns.length + shift))));
  }

  const question = candidates.find((candidate) => !asked.has(candidate)) || FOLLOW_UPS.find((f) => !asked.has(f)) || candidates[0];
  return { round, question, intent: `${round} question` };
}

export function heuristicEvaluation(answer, profile) {
  const text = answer.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const skillHits = (profile.skills || []).filter((skill) => text.includes(skill.name.toLowerCase())).length;
  const specifics = (text.match(/\d+|for example|because|tradeoff|instead|result|improv|reduc|measured|implemented|designed|built/g) || []).length;
  const unsure = /i don'?t know|not sure|no idea|can'?t remember/.test(text);

  const depth = clamp(Math.min(10, words / 12 + specifics + skillHits * 0.7), 0, 10);
  const correctness = clamp(unsure ? 3 : Math.min(9, 4 + specifics * 0.7 + skillHits * 0.4 + (words > 40 ? 1 : 0)), 0, 10);
  const clarity = clamp(words < 8 ? 3 : words > 260 ? 6 : 7 + (specifics > 2 ? 1 : 0), 0, 10);
  const confidence = clamp(unsure ? 3 : words < 15 ? 5 : 7 + (specifics > 3 ? 1 : 0), 0, 10);
  return {
    correctness,
    depth,
    clarity,
    confidence,
    // A candidate who doesn't know shouldn't be pushed deeper on the same topic; move on and mark the gap.
    followUpNeeded: !unsure && (words < 30 || specifics === 0),
    notes: unsure ? "Candidate struggled; moved on and marked as a gap." : words < 30 ? "Answer was brief; probe for specifics." : specifics === 0 ? "Answer lacked concrete detail." : "Reasonable answer with some specifics."
  };
}

// ---------- Public API ----------

export async function generateOpening({ profile, interview, userName }) {
  const ai = await callJson({
    label: "interviewer-opening",
    system: SYSTEM,
    maxTokens: 400,
    prompt: `Candidate name: ${userName}\nCandidate profile: ${profileSummary(profile)}\nInterview roadmap: ${interview.roadmap.map((r) => r.round).join(" -> ")}\n\nOpen the interview: greet the candidate by first name and ask the first Introduction-round question.\nReturn JSON: { "question": "string", "intent": "string" }`
  });
  if (ai?.question) return { round: "Introduction", question: String(ai.question), intent: ai.intent || "Introduction" };
  return heuristicQuestion("Introduction", profile, [], userName);
}

/**
 * Evaluate the latest answer and produce the next question.
 * `allowedRounds` is decided by the session state machine; the model may only pick from it.
 * `followUpOnlyRound` (optional) is the current round, allowed only for a follow-up to the last answer.
 */
export async function nextTurn({ profile, turns, answer, allowedRounds, followUpOnlyRound, userName }) {
  const roundRule = followUpOnlyRound
    ? `You may either ask ONE follow-up in the "${followUpOnlyRound}" round (only if the last answer was shallow, vague, or incorrect), or move to the "${allowedRounds[0]}" round.`
    : `The next question must be in the "${allowedRounds[0]}" round.`;

  const ai = await callJson({
    label: "interviewer-turn",
    system: SYSTEM,
    maxTokens: 700,
    prompt: `Candidate name: ${userName}
Candidate profile: ${profileSummary(profile)}

Transcript so far:
${transcriptText(turns)}

The candidate just answered: """${answer}"""

${roundRule}
Do not repeat any earlier question.

Return JSON:
{
  "evaluation": { "correctness": 0-10, "depth": 0-10, "clarity": 0-10, "confidence": 0-10, "followUpNeeded": boolean, "notes": "one-line private note" },
  "round": "${[followUpOnlyRound, ...allowedRounds].filter(Boolean).join('" | "')}",
  "question": "the next question to ask",
  "intent": "what this question assesses"
}`
  });

  const validRounds = [followUpOnlyRound, ...allowedRounds].filter(Boolean);
  if (ai?.question && ai.evaluation) {
    const evaluation = {
      correctness: clamp(ai.evaluation.correctness, 0, 10),
      depth: clamp(ai.evaluation.depth, 0, 10),
      clarity: clamp(ai.evaluation.clarity, 0, 10),
      confidence: clamp(ai.evaluation.confidence, 0, 10),
      followUpNeeded: Boolean(ai.evaluation.followUpNeeded),
      notes: String(ai.evaluation.notes || "")
    };
    const round = validRounds.includes(ai.round) ? ai.round : allowedRounds[0];
    return { evaluation, round, question: String(ai.question), intent: ai.intent || round };
  }

  const evaluation = heuristicEvaluation(answer, profile);
  const asked = new Set(turns.map((turn) => turn.question));
  const lastTurn = turns.at(-1);
  // Follow up at most once in a row, and only while still allowed to stay in the current round.
  const followUpRound = followUpOnlyRound || (allowedRounds[0] === lastTurn?.round ? lastTurn.round : null);
  if (followUpRound && evaluation.followUpNeeded && !FOLLOW_UPS.includes(lastTurn?.question)) {
    const followUp = FOLLOW_UPS.find((question) => !asked.has(question));
    if (followUp) return { evaluation, round: followUpRound, question: followUp, intent: "Probe for depth" };
  }
  return { evaluation, ...heuristicQuestion(allowedRounds[0], profile, turns, userName) };
}
