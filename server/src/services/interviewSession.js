import { env } from "../config/env.js";
import { CLOSING_MESSAGE } from "../data/questionBank.js";
import { findProblem } from "../data/codingProblems.js";
import { CandidateProfile, CodingSubmission, Interview, InterviewTurn, Report, User } from "../models/index.js";
import { HttpError, average, clamp } from "../utils/http.js";
import { aggregateCommunication, analyzeAnswer } from "./agents/communicationAgent.js";
import { evaluateInterview } from "./agents/evaluationAgent.js";
import { generateOpening, heuristicEvaluation, nextTurn } from "./agents/interviewerAgent.js";
import { buildStrategy, nextConversationRound } from "./agents/strategyAgent.js";

/** Use a free interview first, then a paid credit. Atomic so parallel requests can't overspend. */
async function consumeQuota(userId) {
  const free = await User.findOneAndUpdate({ _id: userId, freeInterviewsUsed: { $lt: env.freeInterviewLimit } }, { $inc: { freeInterviewsUsed: 1 } }, { returnDocument: "after" });
  if (free) return { isPaid: false };
  const paid = await User.findOneAndUpdate({ _id: userId, credits: { $gt: 0 } }, { $inc: { credits: -1 } }, { returnDocument: "after" });
  if (paid) return { isPaid: true };
  throw new HttpError(402, "You've used your free interviews. Buy a credit on the Pricing page to continue.");
}

async function refundQuota(userId, isPaid) {
  await User.updateOne({ _id: userId }, isPaid ? { $inc: { credits: 1 } } : { $inc: { freeInterviewsUsed: -1 } });
}

export async function loadInterview(id, userId) {
  const interview = await Interview.findOne({ _id: id, userId });
  if (!interview) throw new HttpError(404, "Interview not found");
  return interview;
}

export async function createInterview(user, { targetRole, mode }) {
  const profile = await CandidateProfile.findOne({ userId: user._id }).sort({ createdAt: -1 });
  if (!profile) throw new HttpError(400, "Upload your resume first so the interview can be tailored to you.");

  // Abandon any interview left in progress rather than leaving it dangling.
  await Interview.updateMany({ userId: user._id, status: "in_progress" }, { status: "cancelled" });

  const { isPaid } = await consumeQuota(user._id);
  try {
    const strategy = buildStrategy(profile);
    const role = targetRole || profile.targetRole || "Software Engineer";
    const interview = await Interview.create({
      userId: user._id,
      candidateProfileId: profile._id,
      title: `${role} mock interview`,
      targetRole: role,
      difficulty: strategy.difficulty,
      mode: mode || "text",
      isPaid,
      roadmap: strategy.roadmap,
      currentRound: "Introduction",
      codingProblemId: strategy.problem.id,
      status: "in_progress",
      startedAt: new Date()
    });

    await CodingSubmission.create({ interviewId: interview._id, userId: user._id, problemId: strategy.problem.id });

    const opening = await generateOpening({ profile: { ...profile.toObject(), targetRole: role }, interview, userName: user.name });
    const turn = await InterviewTurn.create({ interviewId: interview._id, userId: user._id, round: "Introduction", sequence: 1, question: opening.question, intent: opening.intent });
    return { interview, turns: [turn] };
  } catch (error) {
    await refundQuota(user._id, isPaid);
    throw error;
  }
}

export function liveAnalysis(turns) {
  const answered = turns.filter((turn) => turn.answerTranscript);
  if (!answered.length) return null;
  const comm = aggregateCommunication(answered.map((turn) => turn.communication));
  const depth = average(answered.map((turn) => turn.internalEvaluation?.depth ?? 5)) * 10;
  return [
    { label: "Clarity", value: comm.clarity },
    { label: "Depth", value: clamp(depth) },
    { label: "Confidence", value: comm.confidence },
    { label: "Pace", value: comm.pace }
  ];
}

export async function submitAnswer(user, interviewId, { answer, durationSeconds }) {
  const interview = await loadInterview(interviewId, user._id);
  if (interview.status !== "in_progress") throw new HttpError(409, "This interview is no longer active");
  if (interview.conversationDone) throw new HttpError(409, "The conversational rounds are finished. Submit your code and end the interview.");

  const turns = await InterviewTurn.find({ interviewId }).sort({ sequence: 1 });
  const current = turns.at(-1);
  if (!current || current.answerTranscript) throw new HttpError(409, "No pending question to answer");

  current.answerTranscript = answer;
  current.answerDurationSeconds = durationSeconds;
  current.answeredAt = new Date();
  current.communication = analyzeAnswer(answer, durationSeconds);

  // Decide which rounds the interviewer may move to next.
  const round = interview.currentRound;
  const roundPlan = interview.roadmap.find((item) => item.round === round);
  const askedInRound = turns.filter((turn) => turn.round === round).length;
  const next = nextConversationRound(interview.roadmap, round);
  const target = roundPlan?.estimatedQuestions || 1;

  let allowedRounds;
  let followUpOnlyRound = null;
  if (askedInRound < target) allowedRounds = [round];
  else if (next) {
    allowedRounds = [next.round];
    if (askedInRound === target) followUpOnlyRound = round;
  } else allowedRounds = [];

  const profile = await CandidateProfile.findById(interview.candidateProfileId);
  const profileData = { ...profile.toObject(), targetRole: interview.targetRole };

  if (!allowedRounds.length) {
    // Closing round answered: evaluate the final answer and finish the conversation.
    current.internalEvaluation = heuristicEvaluation(answer, profileData);
    await current.save();
    interview.roadmap.forEach((item) => {
      if (item.round !== "Coding") item.completed = true;
    });
    interview.conversationDone = true;
    await interview.save();
    return { interview, turns, nextQuestion: null, closingMessage: CLOSING_MESSAGE };
  }

  const result = await nextTurn({ profile: profileData, turns, answer, allowedRounds, followUpOnlyRound, userName: user.name });
  current.internalEvaluation = result.evaluation;
  await current.save();

  if (result.round !== round) {
    const finished = interview.roadmap.find((item) => item.round === round);
    if (finished) finished.completed = true;
    interview.currentRound = result.round;
  }
  await interview.save();

  const nextQuestion = await InterviewTurn.create({
    interviewId: interview._id,
    userId: user._id,
    round: result.round,
    sequence: current.sequence + 1,
    question: result.question,
    intent: result.intent
  });
  turns.push(nextQuestion);
  return { interview, turns, nextQuestion };
}

export async function completeInterview(user, interviewId) {
  const interview = await loadInterview(interviewId, user._id);
  const existing = await Report.findOne({ interviewId });
  if (existing) return { interview, report: existing };
  if (interview.status !== "in_progress") throw new HttpError(409, "This interview was cancelled");

  const turns = await InterviewTurn.find({ interviewId }).sort({ sequence: 1 });
  if (!turns.some((turn) => turn.answerTranscript)) throw new HttpError(400, "Answer at least one question before ending the interview");

  const [profile, codingSubmission] = await Promise.all([
    CandidateProfile.findById(interview.candidateProfileId),
    CodingSubmission.findOne({ interviewId })
  ]);
  const communication = aggregateCommunication(turns.map((turn) => turn.communication));
  const evaluation = await evaluateInterview({
    profile: profile.toObject(),
    turns,
    communication,
    codingSubmission,
    problem: findProblem(interview.codingProblemId)
  });

  const report = await Report.create({ interviewId, userId: user._id, ...evaluation });

  interview.status = "completed";
  interview.completedAt = new Date();
  interview.durationSeconds = Math.round((interview.completedAt - interview.startedAt) / 1000);
  await interview.save();
  return { interview, report };
}
