// Seeds a demo account with a resume profile and three completed interviews showing steady improvement.
// Usage: npm run seed   (safe to re-run; it resets only the demo account)
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "./config/db.js";
import { findProblem } from "./data/codingProblems.js";
import { CandidateProfile, CodingSubmission, Interview, InterviewTurn, Payment, Report, Resume, User } from "./models/index.js";
import { evaluateCode } from "./services/agents/codingAgent.js";
import { aggregateCommunication, analyzeAnswer } from "./services/agents/communicationAgent.js";
import { evaluateInterview } from "./services/agents/evaluationAgent.js";
import { heuristicEvaluation } from "./services/agents/interviewerAgent.js";
import { analyzeResume } from "./services/agents/resumeAgent.js";
import { buildStrategy } from "./services/agents/strategyAgent.js";
import { runJavaScript } from "./services/codeRunner.js";
import { aiProvider } from "./services/llm.js";

export const DEMO_USER = { name: "Aarav Sharma", email: "demo@interviewiq.app", password: "demo12345", title: "Final-year CSE student" };

const RESUME_TEXT = `Aarav Sharma
aarav.sharma@example.com | github.com/aarav-dev | linkedin.com/in/aarav-sharma
Summary
Final-year B.Tech Computer Science student focused on full stack web development with React and Node.js.
Skills
JavaScript, TypeScript, React, Node.js, Express, MongoDB, SQL, Git, Docker, REST APIs, Data Structures and Algorithms
Projects
Campus Hiring Portal | React, Express, MongoDB
- Built a recruiter dashboard with filters and a shortlist workflow used by 2,000+ students
- Reduced manual shortlisting time by 40% with automated eligibility checks
Expense Tracker | React, Firebase
- Developed spending analytics charts and role-based authentication
Experience
Web Development Intern - TechCorp (May 2025 - Jul 2025)
- Implemented REST APIs in Node.js serving 10k requests per day
- Improved API response time by 30% by adding MongoDB indexes
Education
B.Tech Computer Science, XYZ University, 2026, CGPA 8.4`;

const QUESTIONS = {
  Introduction: "Thanks for joining, Aarav. Walk me through your background and what draws you to this role.",
  Resume: "Your resume mentions improving API response time by 30%. How did you find and fix the bottleneck?",
  Technical: "How does React decide what to re-render, and when would you use useMemo or useCallback?",
  Project: "Walk me through the architecture of the Campus Hiring Portal and one tradeoff you made.",
  Behavioral: "Tell me about a time you disagreed with a teammate. How did you handle it?",
  Stress: "Production is down right after your deploy on a Friday evening. What do you do in the first fifteen minutes?",
  Closing: "What's one thing you'd do differently in this interview, and do you have any questions for me?"
};

// Three sessions with answers that get progressively stronger, so the dashboard shows real improvement.
const SESSIONS = [
  {
    daysAgo: 21,
    minutes: 31,
    answers: {
      Introduction: "I am a student, um, I like web development and I know React.",
      Resume: "I think I added an index, maybe, and it became faster.",
      Technical: "React re-renders when state changes. useMemo is like for memoizing I guess.",
      Project: "It was React and Express and MongoDB. Basically a dashboard.",
      Behavioral: "We disagreed once but then we just did what the senior said.",
      Stress: "I would check the logs I guess and maybe roll back.",
      Closing: "I would prepare more. No questions."
    },
    code: "function twoSum(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = 0; j < nums.length; j++) {\n      if (nums[i] + nums[j] === target) return [i, j];\n    }\n  }\n}"
  },
  {
    daysAgo: 12,
    minutes: 38,
    answers: {
      Introduction: "I'm a final year computer science student. I build full stack apps with React and Node, and I interned at TechCorp where I built REST APIs.",
      Resume: "At TechCorp one endpoint was slow, so I used explain on the MongoDB query and saw a collection scan. I added a compound index and the response time improved by about 30 percent.",
      Technical: "React re-renders a component when its state or props change, and then its children. useMemo caches an expensive computed value and useCallback keeps a function reference stable, which helps when passing callbacks to memoized children.",
      Project: "The portal has a React frontend, an Express API and MongoDB. I chose MongoDB because the candidate schema changed often. One tradeoff was client side filtering, which was simple but slow for large lists.",
      Behavioral: "A teammate wanted to add a feature late in the sprint. I listened to their reasons, then we compared the risk and agreed to ship it in the next sprint instead.",
      Stress: "First I would roll back the deploy to restore service, then tell the team in our channel, and then look at logs and metrics to find the root cause.",
      Closing: "I would structure my answers better from the start. I'd like to know how the team does code reviews."
    },
    code: "function twoSum(nums, target) {\n  const seen = {};\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen[need] !== undefined) return [seen[need], i];\n    seen[nums[i]] = i;\n  }\n  return [];\n}"
  },
  {
    daysAgo: 4,
    minutes: 42,
    answers: {
      Introduction: "I'm a final year computer science student specializing in full stack development. During my internship at TechCorp I built Node.js APIs serving 10k requests a day, and my campus hiring portal is used by over 2,000 students. I'm excited about this role because it combines frontend craft with backend performance work.",
      Resume: "The orders endpoint took over 800 milliseconds. First I profiled it with MongoDB explain and found a collection scan on status and createdAt. I added a compound index matching the sort order, which removed the in-memory sort. As a result p95 latency dropped by about 30 percent, and I added a dashboard to monitor it.",
      Technical: "React re-renders a component when its state, props, or consumed context change, and by default its children re-render too. Reconciliation then diffs the virtual DOM so only changed nodes update. I use useMemo for expensive derived data, like filtering 2,000 candidates, and useCallback to keep handler references stable for children wrapped in React.memo. I avoid using them everywhere because memoization has its own cost.",
      Project: "The portal is a React frontend, an Express REST API, and MongoDB. The key tradeoff was pagination: client side filtering was simple but froze with large lists, so I moved to cursor based pagination on the server with an index on createdAt. That kept the dashboard responsive and reduced payload size by about 70 percent.",
      Behavioral: "In my internship a teammate and I disagreed on whether to build a custom auth flow. The situation was a tight two week deadline. I proposed we each list the risks and effort, then we reviewed them with our mentor. We chose the existing library, which let us ship on time, and I took ownership of writing the integration tests.",
      Stress: "First I'd roll back to the last good release to restore service, and post a status update so everyone knows who is handling it. Then I'd check error rates and logs to confirm recovery. Once stable, I'd find the root cause in the diff, add a test, and write a short postmortem so it doesn't happen again.",
      Closing: "I'd spend a little less time on context and get to the result faster. My question is: how do you measure success for a new engineer in the first ninety days?"
    },
    code: "function twoSum(nums, target) {\n  // Map each value to its index so we can find the complement in O(1)\n  const indexByValue = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (indexByValue.has(complement)) return [indexByValue.get(complement), i];\n    indexByValue.set(nums[i], i);\n  }\n  return [];\n}"
  }
];

async function resetDemoUser() {
  const existing = await User.findOne({ email: DEMO_USER.email });
  if (!existing) return;
  const userId = existing._id;
  await Promise.all(
    [Resume, CandidateProfile, Interview, InterviewTurn, CodingSubmission, Report, Payment].map((Model) => Model.deleteMany({ userId }))
  );
  await existing.deleteOne();
}

async function seedSession(user, profile, session) {
  const completedAt = new Date(Date.now() - session.daysAgo * 86400000);
  const startedAt = new Date(completedAt - session.minutes * 60000);
  const strategy = buildStrategy(profile);
  const problem = findProblem("two-sum");

  const [interview] = await Interview.create(
    [
      {
        userId: user._id,
        candidateProfileId: profile._id,
        title: `${profile.targetRole} mock interview`,
        targetRole: profile.targetRole,
        difficulty: strategy.difficulty,
        status: "completed",
        roadmap: strategy.roadmap.map((round) => ({ ...round, completed: true })),
        currentRound: "Closing",
        conversationDone: true,
        codingProblemId: problem.id,
        startedAt,
        completedAt,
        durationSeconds: session.minutes * 60,
        createdAt: startedAt,
        updatedAt: completedAt
      }
    ],
    { timestamps: false }
  );

  const rounds = strategy.roadmap.map((round) => round.round).filter((round) => round !== "Coding");
  const turns = await InterviewTurn.insertMany(
    rounds.map((round, index) => {
      const answer = session.answers[round];
      return {
        interviewId: interview._id,
        userId: user._id,
        round,
        sequence: index + 1,
        question: QUESTIONS[round],
        intent: `${round} question`,
        answerTranscript: answer,
        answerDurationSeconds: Math.round(answer.split(/\s+/).length / 2.3),
        answeredAt: startedAt,
        internalEvaluation: heuristicEvaluation(answer, profile),
        communication: analyzeAnswer(answer, Math.round(answer.split(/\s+/).length / 2.3))
      };
    })
  );

  const execution = await runJavaScript(problem, session.code);
  const aiEvaluation = await evaluateCode({ problem, code: session.code, language: "javascript", execution });
  const codingSubmission = await CodingSubmission.create({
    interviewId: interview._id,
    userId: user._id,
    problemId: problem.id,
    language: "javascript",
    code: session.code,
    attempts: 1,
    executionResult: { status: execution.status, runtimeMs: execution.runtimeMs, testCasesPassed: execution.testCasesPassed, totalTestCases: execution.totalTestCases },
    aiEvaluation
  });

  const evaluation = await evaluateInterview({
    profile: profile.toObject(),
    turns,
    communication: aggregateCommunication(turns.map((turn) => turn.communication)),
    codingSubmission,
    problem
  });
  await Report.create([{ interviewId: interview._id, userId: user._id, ...evaluation, createdAt: completedAt, updatedAt: completedAt }], { timestamps: false });
  return evaluation.overallScore;
}

async function main() {
  await connectDb();
  console.log(`[seed] AI provider: ${aiProvider}${aiProvider === "gemini" ? " (this takes a minute)" : ""}`);
  await resetDemoUser();

  const user = await User.create({
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    title: DEMO_USER.title,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10),
    credits: 2
  });

  const resume = await Resume.create({
    userId: user._id,
    originalName: "Aarav_Sharma_Resume.pdf",
    mimeType: "application/pdf",
    size: RESUME_TEXT.length,
    parsedText: RESUME_TEXT,
    parseStatus: "completed"
  });
  const { profile: profileData, generatedBy, raw } = await analyzeResume(RESUME_TEXT, "Full Stack Developer");
  const profile = await CandidateProfile.create({
    userId: user._id,
    resumeId: resume._id,
    resumeFileName: resume.originalName,
    ...profileData,
    technologies: profileData.skills.filter((skill) => skill.category !== "soft_skill").map((skill) => skill.name),
    generatedBy,
    rawAiOutput: raw
  });
  console.log(`[seed] Profile: ${profile.targetRole}, ${profile.skills.length} skills, resume score ${profile.resumeScore}`);

  for (const session of SESSIONS) {
    const score = await seedSession(user, profile, session);
    console.log(`[seed] Interview from ${session.daysAgo} days ago: overall ${score}/100`);
  }

  console.log(`[seed] Done. Sign in with ${DEMO_USER.email} / ${DEMO_USER.password}`);
  await disconnectDb();
}

main().catch(async (error) => {
  console.error("[seed] Failed:", error);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
