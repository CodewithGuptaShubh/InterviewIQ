import Editor from "@monaco-editor/react";
import { motion } from "framer-motion";
import { Code2, Loader2, Mic, MicOff, PhoneOff, Play, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Progress } from "../components/ui/Progress.jsx";
import { Textarea } from "../components/ui/Input.jsx";
import { speak, stopSpeaking, useDictation, useSpeechProvider } from "../hooks/useSpeech.js";
import { useApp } from "../state/AppContext.jsx";

const LANGUAGES = [
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["cpp", "C++"],
  ["c", "C"]
];

export function InterviewPage() {
  const { profile, user, refreshUser, refreshData } = useApp();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .activeInterview()
      .then((data) => setSession(data.session))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function startInterview() {
    setLoading(true);
    setError("");
    try {
      setSession(await api.createInterview({}));
      refreshUser().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    const result = await api.completeInterview(session.interview.id);
    await Promise.all([refreshUser(), refreshData()]).catch(() => {});
    navigate(`/reports/${result.reportId}`);
  }

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-accent-foreground" /></div>;
  if (!session) return <StartCard profile={profile} user={user} error={error} onStart={startInterview} />;
  return <InterviewRoom session={session} setSession={setSession} onFinish={finish} />;
}

function StartCard({ profile, user, error, onStart }) {
  const freeLeft = Math.max(0, 2 - user.freeInterviewsUsed);
  return (
    <Card>
      <CardContent className="p-8">
        <Badge tone="info">Adaptive mock interview</Badge>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold md:text-4xl">{profile ? `Ready for your ${profile.targetRole} interview?` : "Upload your resume to begin"}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {profile
            ? `A ${profile.difficulty.toLowerCase()} interview tailored to your resume: introduction, resume, technical, project, and behavioral rounds plus one coding problem. Takes about 25 minutes.`
            : "The interviewer uses your skills and projects to ask questions that matter for you."}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {freeLeft > 0 ? `This uses 1 of your ${freeLeft} remaining free interviews.` : user.credits > 0 ? `This uses 1 of your ${user.credits} paid credit${user.credits === 1 ? "" : "s"}.` : "You have no interviews left."}
        </p>
        {error && <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="mt-6 flex gap-3">
          {!profile ? (
            <Button asChild="true"><Link to="/resume">Upload resume</Link></Button>
          ) : user.credits === 0 && freeLeft === 0 ? (
            <Button asChild="true"><Link to="/pricing">Buy a credit</Link></Button>
          ) : (
            <Button size="lg" onClick={onStart}>Start interview</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InterviewRoom({ session, setSession, onFinish }) {
  const { interview, liveAnalysis, coding } = session;
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const speechProvider = useSpeechProvider();
  // Seconds of actual speech in the current answer, used for words-per-minute analysis.
  const spokenSeconds = useRef(0);
  const baseSpokenSeconds = useRef(0);
  const transcriptRef = useRef(null);
  const baseAnswer = useRef("");
  const dictation = useDictation(speechProvider, (text, { durationSeconds }) => {
    setAnswer(`${baseAnswer.current}${baseAnswer.current ? " " : ""}${text}`);
    spokenSeconds.current = baseSpokenSeconds.current + durationSeconds;
  });

  const lastMessage = interview.transcript.at(-1);
  const aiSpeaking = lastMessage?.speaker === "ai";

  // Speak each new interviewer message and restart the answer timer.
  useEffect(() => {
    if (!aiSpeaking || !speechProvider) return;
    spokenSeconds.current = 0;
    if (voiceOn) speak(lastMessage.text, speechProvider);
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.transcript.length, speechProvider]);

  useEffect(() => stopSpeaking, []);

  function toggleMic() {
    if (dictation.listening) return dictation.stop();
    stopSpeaking();
    baseAnswer.current = answer;
    baseSpokenSeconds.current = spokenSeconds.current;
    dictation.start();
  }

  async function sendAnswer() {
    if (!answer.trim() || sending || dictation.transcribing) return;
    dictation.stop();
    setSending(true);
    setError("");
    try {
      // Speaking pace is only meaningful for spoken answers.
      const durationSeconds = spokenSeconds.current >= 1 ? Math.round(spokenSeconds.current) : undefined;
      const next = await api.submitAnswer(interview.id, answer.trim(), durationSeconds);
      setSession(next);
      setAnswer("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function endInterview() {
    if (!interview.conversationDone && !window.confirm("End the interview now? Your report will be based on the answers so far.")) return;
    stopSpeaking();
    dictation.stop();
    setEnding(true);
    setError("");
    try {
      await onFinish();
    } catch (err) {
      setError(err.message);
      setEnding(false);
    }
  }

  const currentRound = interview.conversationDone ? "Coding & wrap-up" : `${interview.currentRound} Round`;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid min-h-[460px] md:grid-cols-[0.9fr_1.1fr]">
              <section className="flex flex-col items-center justify-center border-b bg-[linear-gradient(135deg,rgba(34,211,238,.14),rgba(16,185,129,.10))] p-6 md:border-b-0 md:border-r">
                <motion.div animate={sending ? { scale: [1, 1.08, 1] } : { scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: sending ? 0.9 : 2.2 }} className="relative flex h-44 w-44 items-center justify-center rounded-full border bg-card shadow-glow">
                  <div className="absolute inset-5 rounded-full border border-cyan-300/30" />
                  {sending ? <Loader2 className="h-16 w-16 animate-spin text-accent-foreground" /> : <Volume2 className="h-16 w-16 text-accent-foreground" />}
                </motion.div>
                <Badge className="mt-6" tone={dictation.listening ? "success" : "info"}>
                  {sending
                    ? "Interviewer is thinking..."
                    : dictation.transcribing
                      ? "Transcribing your answer..."
                      : dictation.listening
                        ? dictation.engine === "gemini" ? "Recording — click the mic to stop" : "Listening to your answer"
                        : aiSpeaking ? "Your turn to answer" : "AI interviewer"}
                </Badge>
                <h2 className="mt-4 text-center text-2xl font-semibold">{currentRound}</h2>
                <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">Adaptive follow-ups are based on your last answer and resume context.</p>
                <p className="mt-1 text-xs text-muted-foreground">Voice: {speechProvider === "gemini" ? "Gemini speech" : "browser speech"}</p>
                <div className="mt-6 flex gap-2">
                  {dictation.supported && (
                    <Button variant={dictation.listening ? "secondary" : "outline"} onClick={toggleMic} disabled={interview.conversationDone || dictation.transcribing} aria-label="Toggle microphone">
                      {dictation.transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : dictation.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(!voiceOn); }} aria-label="Toggle interviewer voice">
                    {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button variant="danger" onClick={endInterview} disabled={ending}>
                    {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />} {ending ? "Generating report..." : "End"}
                  </Button>
                </div>
              </section>
              <section className="flex max-h-[620px] flex-col p-5">
                <div className="mb-4">
                  <div className="flex justify-between text-sm"><span>Interview progress</span><span>{interview.progress}%</span></div>
                  <Progress value={interview.progress} />
                </div>
                <div ref={transcriptRef} className="hide-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
                  {interview.transcript.map((turn, index) => (
                    <div key={`${turn.speaker}-${index}`} className={turn.speaker === "ai" ? "mr-8 rounded-lg border bg-muted/70 p-4" : "ml-8 rounded-lg bg-primary p-4 text-primary-foreground"}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">{turn.speaker === "ai" ? `Interviewer • ${turn.round}` : "You"}</p>
                      <p className="text-sm leading-6">{turn.text}</p>
                    </div>
                  ))}
                </div>
                {(error || dictation.error) && <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error || dictation.error}</p>}
                <div className="mt-4 flex gap-2">
                  <Textarea
                    value={answer}
                    disabled={interview.conversationDone}
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) sendAnswer();
                    }}
                    placeholder={interview.conversationDone ? "Conversation complete. Finish the coding round, then click End." : "Type your answer or use the mic... (Ctrl+Enter to send)"}
                    className="min-h-20"
                  />
                  <Button className="h-auto px-3" onClick={sendAnswer} disabled={sending || dictation.transcribing || interview.conversationDone || !answer.trim()} aria-label="Send answer">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <CodingRound interviewId={interview.id} problem={coding.problem} initialSubmission={coding.submission} difficulty={interview.difficulty} onSubmitted={(progress) => setSession((s) => ({ ...s, interview: { ...s.interview, progress, roadmap: s.interview.roadmap.map((r) => (r.round === "Coding" ? { ...r, completed: true } : r)) } }))} />
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Round roadmap</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {interview.roadmap.map((round) => (
              <div key={round.round} className="flex items-center justify-between rounded-md border bg-background/50 p-3 text-sm">
                <span title={round.goal}>{round.round}</span>
                <Badge tone={round.completed ? "success" : round.current ? "info" : "default"}>{round.completed ? "Done" : round.current ? "Now" : round.round === "Coding" ? "Editor" : "Next"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Live analysis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!liveAnalysis && <p className="text-sm text-muted-foreground">Answer the first question to see live signals.</p>}
            {liveAnalysis?.map(({ label, value }) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm"><span>{label}</span><span>{value}%</span></div>
                <Progress value={value} />
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function CodingRound({ interviewId, problem, initialSubmission, difficulty, onSubmitted }) {
  const [language, setLanguage] = useState(initialSubmission?.language || "javascript");
  const [drafts, setDrafts] = useState(() => ({ ...problem.starterCode, ...(initialSubmission ? { [initialSubmission.language]: initialSubmission.code } : {}) }));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(initialSubmission ? { submission: initialSubmission, testResults: [] } : null);
  const [error, setError] = useState("");

  async function runCode() {
    setRunning(true);
    setError("");
    try {
      const data = await api.submitCode(interviewId, language, drafts[language]);
      setResult(data);
      onSubmitted(data.progress);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const execution = result?.submission.executionResult;
  const review = result?.submission.aiEvaluation;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Coding round</CardTitle>
          <Badge tone="warning"><Code2 className="mr-1 h-3 w-3" /> {difficulty}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border bg-background/50 p-4">
            <h3 className="font-semibold">{problem.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{problem.statement}</p>
            {problem.examples.map((example) => (
              <div key={example.input} className="mt-4 rounded-md bg-muted p-3 text-sm">Input: {example.input}<br />Output: {example.output}{example.explanation && <><br /><span className="text-muted-foreground">{example.explanation}</span></>}</div>
            ))}
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {problem.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-background/60 px-3 py-2">
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
                {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{language === "javascript" ? `Runs ${problem.totalTests} hidden tests` : "AI code review (tests run for JavaScript)"}</span>
            </div>
            <Editor height="320px" language={language} theme="vs-dark" value={drafts[language]} onChange={(value) => setDrafts({ ...drafts, [language]: value || "" })} options={{ minimap: { enabled: false }, fontSize: 14 }} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2 rounded-md border bg-background/50 px-3 py-2 text-sm">
            {error && <p className="text-red-300">{error}</p>}
            {!result && !error && <p className="text-muted-foreground">Write your solution, then run it against the tests.</p>}
            {execution && (
              <p className={execution.status === "accepted" ? "text-emerald-300" : "text-amber-300"}>
                {execution.totalTestCases ? `${execution.testCasesPassed}/${execution.totalTestCases} tests passed` : "Submitted for review"} • {execution.status.replace("_", " ")}
                {execution.runtimeMs ? ` • ${execution.runtimeMs} ms` : ""}
              </p>
            )}
            {execution?.stderr && <pre className="whitespace-pre-wrap text-xs text-red-300">{execution.stderr}</pre>}
            {result?.testResults?.filter((test) => !test.passed).slice(0, 2).map((test) => (
              <p key={test.input} className="font-mono text-xs text-muted-foreground">Input {test.input} → expected {test.expected}, got {test.error || test.actual}</p>
            ))}
            {review && <p className="text-muted-foreground">Complexity {review.complexity}. {review.feedback}</p>}
          </div>
          <Button onClick={runCode} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {running ? "Running..." : "Run & submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
