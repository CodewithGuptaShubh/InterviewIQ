import { spawn } from "node:child_process";

const TIMEOUT_MS = 4000;
const MAX_OUTPUT = 20000;
const RESULT_MARKER = "__IQ_RESULT__";

const nodeMajor = Number(process.versions.node.split(".")[0]);
// Node's permission model blocks filesystem, child processes, workers and native addons for the untrusted script.
const PERMISSION_FLAG = nodeMajor >= 23 ? "--permission" : "--experimental-permission";

function harness(problem, code) {
  return `"use strict";
const __tests = ${JSON.stringify(problem.tests)};
const __compare = ${JSON.stringify(problem.compare || "exact")};
const __logs = [];
console.log = console.info = console.warn = console.error = (...args) => {
  if (__logs.length < 200) __logs.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
};
const __sortDeep = (value, depth) => {
  if (!Array.isArray(value)) return value;
  const inner = depth > 0 ? value.map((v) => __sortDeep(v, depth - 1)) : value;
  return [...inner].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
const __normalize = (value) =>
  __compare === "unordered" ? __sortDeep(value, 0) : __compare === "nested-unordered" ? __sortDeep(value, 1) : value;
const __done = (payload) => process.stdout.write("\\n${RESULT_MARKER}" + JSON.stringify({ ...payload, logs: __logs }) + "\\n");

let __fn;
try {
  __fn = (function () {
${code}
;return typeof ${problem.functionName} === "function" ? ${problem.functionName} : undefined;
  })();
} catch (error) {
  __done({ status: "compile_error", error: String(error && error.stack || error) });
  process.exit(0);
}
if (typeof __fn !== "function") {
  __done({ status: "compile_error", error: "Function ${problem.functionName} is not defined" });
  process.exit(0);
}
const __results = [];
const __start = process.hrtime.bigint();
for (const test of __tests) {
  const args = JSON.parse(JSON.stringify(test.args));
  try {
    const actual = __fn(...args);
    const passed = JSON.stringify(__normalize(actual)) === JSON.stringify(__normalize(test.expected));
    __results.push({ passed, input: JSON.stringify(test.args), expected: JSON.stringify(test.expected), actual: JSON.stringify(actual) ?? "undefined" });
  } catch (error) {
    __results.push({ passed: false, input: JSON.stringify(test.args), expected: JSON.stringify(test.expected), error: String(error && error.message || error) });
  }
}
__done({ status: "completed", results: __results, runtimeMs: Number(process.hrtime.bigint() - __start) / 1e6 });
`;
}

/** Run a JavaScript solution against the problem's tests in an isolated child process. */
export function runJavaScript(problem, code) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PERMISSION_FLAG, "--max-old-space-size=64", "--input-type=commonjs", "-"], {
      env: { SystemRoot: process.env.SystemRoot || "", PATH: "" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve(failure("runtime_error", error.message, problem));
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (timedOut) return resolve(failure("timeout", `Execution exceeded ${TIMEOUT_MS / 1000}s. Check for infinite loops.`, problem));

      const line = stdout.split("\n").find((l) => l.startsWith(RESULT_MARKER));
      if (!line) return resolve(failure("runtime_error", stderr.trim().split("\n").slice(-6).join("\n") || "Program crashed", problem));

      const payload = JSON.parse(line.slice(RESULT_MARKER.length));
      if (payload.status !== "completed") return resolve(failure(payload.status, payload.error, problem, payload.logs));

      const passed = payload.results.filter((result) => result.passed).length;
      resolve({
        status: passed === payload.results.length ? "accepted" : "wrong_answer",
        testCasesPassed: passed,
        totalTestCases: payload.results.length,
        runtimeMs: Math.round(payload.runtimeMs * 100) / 100,
        results: payload.results,
        stdout: payload.logs.join("\n"),
        stderr: ""
      });
    });

    child.stdin.end(harness(problem, code));
  });
}

function failure(status, message, problem, logs = []) {
  return { status, testCasesPassed: 0, totalTestCases: problem.tests.length, runtimeMs: 0, results: [], stdout: logs.join("\n"), stderr: message || "" };
}
