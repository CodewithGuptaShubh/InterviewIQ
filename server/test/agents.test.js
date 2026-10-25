import assert from "node:assert/strict";
import { test } from "node:test";
import { findProblem } from "../src/data/codingProblems.js";
import { analyzeAnswer } from "../src/services/agents/communicationAgent.js";
import { overallScore, scoreBand } from "../src/services/agents/evaluationAgent.js";
import { heuristicEvaluation } from "../src/services/agents/interviewerAgent.js";
import { buildStrategy, nextConversationRound } from "../src/services/agents/strategyAgent.js";
import { runJavaScript } from "../src/services/codeRunner.js";

test("overall score uses the blueprint weights", () => {
  assert.equal(overallScore({ technical: 100, communication: 0, coding: 0, behavioral: 0, consistency: 0 }), 35);
  assert.equal(overallScore({ technical: 80, communication: 70, coding: 60, behavioral: 90, consistency: 50 }), 73);
  assert.equal(scoreBand(73), "Acceptable");
});

test("communication analysis penalizes fillers", () => {
  const clean = analyzeAnswer("First I profiled the query, then I added an index because the scan was slow. As a result latency dropped by 60 percent.");
  const filler = analyzeAnswer("Um so like basically I um added an index you know and uh it was like faster I guess.");
  assert.ok(clean.fillers > filler.fillers);
  assert.ok(clean.structure > filler.structure);
  assert.ok(filler.fillerCount >= 6);
});

test("heuristic evaluation moves on when the candidate does not know", () => {
  assert.equal(heuristicEvaluation("I don't know", { skills: [] }).followUpNeeded, false);
  assert.equal(heuristicEvaluation("I used React", { skills: [] }).followUpNeeded, true);
});

test("strategy skips the editor-driven coding round in conversation", () => {
  const { roadmap } = buildStrategy({ difficulty: "intermediate" });
  assert.equal(nextConversationRound(roadmap, "Behavioral").round, "Closing");
  assert.equal(nextConversationRound(roadmap, "Closing"), null);
});

test("code runner executes tests and sandboxes the filesystem", async () => {
  const problem = findProblem("two-sum");
  const ok = await runJavaScript(problem, "function twoSum(n,t){const m=new Map();for(let i=0;i<n.length;i++){if(m.has(t-n[i]))return[m.get(t-n[i]),i];m.set(n[i],i)}}");
  assert.equal(ok.status, "accepted");
  const fs = await runJavaScript(problem, "function twoSum(){ return require('fs').readdirSync('.') }");
  assert.match(fs.results[0].error, /restricted|permission/i);
  const loop = await runJavaScript(problem, "function twoSum(){ while(true){} }");
  assert.equal(loop.status, "timeout");
});

test("heuristic resume analysis returns a score and prioritized suggestions", async () => {
  const { analyzeResume } = await import("../src/services/agents/resumeAgent.js");
  const { profile } = await analyzeResume("Jane Doe\nSkills\nReact, Node.js\nProjects\nTodo App\n- Made a todo app with React", "Frontend Developer");
  assert.ok(profile.resumeScore >= 25 && profile.resumeScore <= 100);
  assert.ok(profile.suggestions.some((s) => s.priority === "High"));
  assert.ok(profile.suggestions.every((s) => s.section && s.suggestion));
});

test("razorpay signatures are verified with HMAC-SHA256", async () => {
  const crypto = await import("node:crypto");
  const { isValidSignature } = await import("../src/services/razorpay.js");
  const secret = "test_secret";
  const good = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.equal(isValidSignature("order_1|pay_1", good, secret), true);
  assert.equal(isValidSignature("order_1|pay_2", good, secret), false);
  assert.equal(isValidSignature("order_1|pay_1", "deadbeef", secret), false);
  assert.equal(isValidSignature("order_1|pay_1", undefined, secret), false);
});
