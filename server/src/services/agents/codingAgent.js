import { clamp } from "../../utils/http.js";
import { callJson } from "../llm.js";

const SYSTEM = `You are the code evaluation agent for a mock technical interview.
Review the candidate's solution using only the code and test results provided.
Be specific, concise, and constructive.`;

function heuristicReview(code, execution, language) {
  const lines = code.split("\n").filter((line) => line.trim());
  const nestedLoops = /(for|while)[\s\S]{0,400}?\{[\s\S]{0,400}?(for|while)\s*\(/.test(code) || /for .* in [\s\S]{0,200}?\n\s+for .* in/.test(code);
  const usesHash = /\bMap\b|\bSet\b|\{\}|dict\(|set\(|HashMap|unordered_map|new Object/.test(code);
  const sorts = /\.sort\(|sorted\(|Arrays\.sort|std::sort/.test(code);
  const shortNames = (code.match(/\b(let|const|var|int|auto)\s+[a-z]\b/g) || []).length;
  const comments = (code.match(/\/\/|#|\/\*/g) || []).length;
  const passRate = execution?.totalTestCases ? execution.testCasesPassed / execution.totalTestCases : null;
  // Untouched starter code is a signature with no body; strip comments and whitespace to detect it.
  const meaningfulChars = code.replace(/\/\/.*|#.*|\/\*[\s\S]*?\*\/|\bpass\b|\s+/g, "").length;
  const empty = !passRate && meaningfulChars < 45;
  const correctness = empty ? 0 : passRate != null ? clamp(passRate * 100) : 55;
  const complexity = nestedLoops ? "O(n^2)" : sorts ? "O(n log n)" : usesHash || lines.length < 25 ? "O(n)" : "Unclear";
  const efficiency = empty ? 0 : clamp(nestedLoops ? 55 : sorts ? 78 : 88);
  const readability = empty ? 0 : clamp(82 - shortNames * 4 + Math.min(comments, 3) * 3 - (lines.length > 60 ? 10 : 0));
  const logic = empty ? 0 : clamp(passRate != null ? 40 + passRate * 55 : 60);

  const feedback = empty
    ? "No meaningful solution was submitted."
    : [
        passRate != null ? `${execution.testCasesPassed}/${execution.totalTestCases} tests passed.` : `${language} solutions are reviewed statically; switch to JavaScript to run the test suite.`,
        `Estimated time complexity: ${complexity}.`,
        nestedLoops ? "Nested loops suggest a quadratic approach; consider a hash map or two-pointer technique." : "The approach scales reasonably.",
        shortNames > 2 ? "Use more descriptive variable names to improve readability." : "Naming is readable."
      ].join(" ");

  return { logic, efficiency, correctness, readability, complexity, feedback };
}

export async function evaluateCode({ problem, code, language, execution }) {
  const fallback = heuristicReview(code, execution, language);
  const ai = await callJson({
    label: "coding-agent",
    system: SYSTEM,
    maxTokens: 600,
    prompt: `Problem: ${problem.title}\n${problem.statement}\n\nLanguage: ${language}\nCode:\n\`\`\`\n${code.slice(0, 8000)}\n\`\`\`\n\nTest results: ${
      execution?.totalTestCases ? `${execution.testCasesPassed}/${execution.totalTestCases} passed (status: ${execution.status})` : "not executed (non-JavaScript language); judge correctness by reading the code"
    }\n\nReturn JSON: { "logic": 0-100, "efficiency": 0-100, "correctness": 0-100, "readability": 0-100, "complexity": "Big-O time complexity", "feedback": "2-3 sentence review" }`
  });
  if (!ai) return fallback;

  return {
    logic: clamp(ai.logic ?? fallback.logic),
    efficiency: clamp(ai.efficiency ?? fallback.efficiency),
    // Executed tests are ground truth for correctness when available.
    correctness: execution?.totalTestCases ? fallback.correctness : clamp(ai.correctness ?? fallback.correctness),
    readability: clamp(ai.readability ?? fallback.readability),
    complexity: String(ai.complexity || fallback.complexity),
    feedback: String(ai.feedback || fallback.feedback)
  };
}
