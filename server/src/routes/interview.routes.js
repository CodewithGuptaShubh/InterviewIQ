import { Router } from "express";
import { z } from "zod";
import { findProblem, publicProblem } from "../data/codingProblems.js";
import { CodingSubmission, Interview, InterviewTurn, Report } from "../models/index.js";
import { evaluateCode } from "../services/agents/codingAgent.js";
import { runJavaScript } from "../services/codeRunner.js";
import { completeInterview, createInterview, liveAnalysis, loadInterview, submitAnswer } from "../services/interviewSession.js";
import { HttpError, parseBody } from "../utils/http.js";
import { serializeInterview, serializeInterviewSummary } from "../utils/serializers.js";

const router = Router();

async function sessionPayload(interview, turns) {
  const submission = await CodingSubmission.findOne({ interviewId: interview._id });
  return {
    interview: serializeInterview(interview, turns),
    liveAnalysis: liveAnalysis(turns),
    coding: {
      problem: publicProblem(findProblem(interview.codingProblemId)),
      submission: submission?.code ? publicSubmission(submission) : null
    }
  };
}

function publicSubmission(submission) {
  return {
    language: submission.language,
    code: submission.code,
    attempts: submission.attempts,
    executionResult: submission.executionResult,
    aiEvaluation: submission.aiEvaluation
  };
}

router.post("/", async (req, res) => {
  const body = parseBody(
    z.object({ targetRole: z.string().trim().max(100).optional(), mode: z.enum(["text", "voice"]).optional() }),
    req.body
  );
  const { interview, turns } = await createInterview(req.user, body);
  res.status(201).json(await sessionPayload(interview, turns));
});

router.get("/", async (req, res) => {
  const interviews = await Interview.find({ userId: req.user._id, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(50);
  const reports = await Report.find({ interviewId: { $in: interviews.map((i) => i._id) } }).select("interviewId overallScore");
  const byInterview = new Map(reports.map((report) => [report.interviewId.toString(), report]));
  res.json({ interviews: interviews.map((interview) => serializeInterviewSummary(interview, byInterview.get(interview._id.toString()))) });
});

router.get("/active", async (req, res) => {
  const interview = await Interview.findOne({ userId: req.user._id, status: "in_progress" }).sort({ createdAt: -1 });
  if (!interview) return res.json({ session: null });
  const turns = await InterviewTurn.find({ interviewId: interview._id }).sort({ sequence: 1 });
  res.json({ session: await sessionPayload(interview, turns) });
});

router.get("/:id", async (req, res) => {
  const interview = await loadInterview(req.params.id, req.user._id);
  const turns = await InterviewTurn.find({ interviewId: interview._id }).sort({ sequence: 1 });
  res.json(await sessionPayload(interview, turns));
});

router.post("/:id/turns", async (req, res) => {
  const body = parseBody(
    z.object({
      answer: z.string().trim().min(1, "cannot be empty").max(5000),
      durationSeconds: z.number().min(0).max(3600).optional()
    }),
    req.body
  );
  const { interview, turns, closingMessage } = await submitAnswer(req.user, req.params.id, body);
  res.json({ ...(await sessionPayload(interview, turns)), closingMessage: closingMessage || null });
});

router.post("/:id/complete", async (req, res) => {
  const { interview, report } = await completeInterview(req.user, req.params.id);
  res.json({ reportId: interview._id.toString(), overallScore: report.overallScore });
});

router.post("/:id/cancel", async (req, res) => {
  const interview = await loadInterview(req.params.id, req.user._id);
  if (interview.status === "in_progress") {
    interview.status = "cancelled";
    await interview.save();
  }
  res.json({ ok: true });
});

router.get("/:id/coding-question", async (req, res) => {
  const interview = await loadInterview(req.params.id, req.user._id);
  res.json({ problem: publicProblem(findProblem(interview.codingProblemId)) });
});

router.post("/:id/coding-submission", async (req, res) => {
  const { language, code } = parseBody(
    z.object({
      language: z.enum(["javascript", "python", "java", "cpp", "c"]),
      code: z.string().min(1, "cannot be empty").max(20000)
    }),
    req.body
  );
  const interview = await loadInterview(req.params.id, req.user._id);
  if (interview.status !== "in_progress") throw new HttpError(409, "This interview is no longer active");

  const problem = findProblem(interview.codingProblemId);
  const execution = language === "javascript" ? await runJavaScript(problem, code) : null;
  const aiEvaluation = await evaluateCode({ problem, code, language, execution });

  const submission = await CodingSubmission.findOneAndUpdate(
    { interviewId: interview._id },
    {
      $set: {
        userId: req.user._id,
        problemId: problem.id,
        language,
        code,
        aiEvaluation,
        executionResult: execution
          ? { status: execution.status, stdout: execution.stdout, stderr: execution.stderr, runtimeMs: execution.runtimeMs, testCasesPassed: execution.testCasesPassed, totalTestCases: execution.totalTestCases }
          : { status: "reviewed", testCasesPassed: null, totalTestCases: null }
      },
      $inc: { attempts: 1 }
    },
    { returnDocument: "after", upsert: true }
  );

  const codingRound = interview.roadmap.find((round) => round.round === "Coding");
  if (codingRound && !codingRound.completed) {
    codingRound.completed = true;
    await interview.save();
  }

  res.json({ submission: publicSubmission(submission), testResults: execution?.results || [], progress: serializeInterview(interview).progress });
});

export default router;
