import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Progress } from "../components/ui/Progress.jsx";
import { useApp } from "../state/AppContext.jsx";

export function ResumePage() {
  const inputRef = useRef(null);
  const { profile, analyzeResume } = useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(profile ? 100 : 0);
  const [fileName, setFileName] = useState(profile?.fileName || "No resume uploaded yet");
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("File is too large (max 5 MB)");
    setError("");
    setFileName(file.name);
    setLoading(true);
    setProgress(24);
    const timers = [setTimeout(() => setProgress(58), 400), setTimeout(() => setProgress(82), 1200)];
    try {
      await analyzeResume(file);
      setProgress(100);
    } catch (err) {
      setError(err.message);
      setProgress(0);
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Resume upload</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files[0]);
            }}
            className="flex min-h-72 w-full flex-col items-center justify-center rounded-lg border border-dashed bg-background/60 p-6 text-center transition hover:bg-muted/50"
          >
            {loading ? <Loader2 className="h-12 w-12 animate-spin text-accent-foreground" /> : <FileUp className="h-12 w-12 text-accent-foreground" />}
            <h2 className="mt-5 text-xl font-semibold">{loading ? "Analyzing your resume" : "Drop your resume here"}</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">PDF, DOC, and DOCX are supported. The analysis extracts skills, projects, experience, education, and interview difficulty.</p>
            <input ref={inputRef} hidden type="file" accept=".pdf,.doc,.docx" onChange={(event) => handleFile(event.target.files[0])} />
          </button>
          <div className="mt-5 space-y-3">
            <div className="flex justify-between text-sm"><span>{fileName}</span><span>{progress}%</span></div>
            <Progress value={progress} />
          </div>
          {error && <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Secure upload", "AI parsed", "Profile ready"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border bg-card/50 p-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-300" /> {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!profile ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <h2 className="text-xl font-semibold">Your candidate profile will appear here</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Upload your resume and InterviewIQ will extract your skills, projects, strengths, and gaps, then tailor every interview question to you.</p>
          </CardContent>
        </Card>
      ) : (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Candidate profile</CardTitle>
              <Badge tone="info">{profile.difficulty}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Metric label="Target role" value={profile.targetRole} />
              <Metric label="Readiness score" value={`${profile.readiness}/100`} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Extracted projects</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {profile.projects.length === 0 && <p className="text-sm text-muted-foreground">No projects were detected. Add a "Projects" section to your resume for deeper project-round questions.</p>}
            {profile.projects.map((project) => (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={project.title} className="rounded-lg border bg-background/50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-semibold">{project.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{project.stack}</p>
                    <p className="mt-2 text-sm">{project.impact}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <ListCard title="Strengths" items={profile.strengths} tone="success" />
          <ListCard title="Gaps to target" items={profile.gaps} tone="warning" />
        </div>
        {profile.suggestions?.length > 0 && <SuggestionsCard score={profile.resumeScore} suggestions={profile.suggestions} />}
        <Button asChild="true" className="w-full" size="lg">
          <Link to="/interview">Start a tailored mock interview <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg border bg-background/50 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>;
}

const PRIORITY_TONE = { High: "warning", Medium: "info", Low: "default" };

function SuggestionsCard({ score, suggestions }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Resume improvement suggestions</CardTitle>
          {score != null && <Badge tone={score >= 75 ? "success" : score >= 55 ? "info" : "warning"}>Resume score {score}/100</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((item) => (
          <div key={`${item.section}-${item.suggestion}`} className="rounded-lg border bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Badge tone={PRIORITY_TONE[item.priority] || "default"}>{item.priority}</Badge>
              <p className="text-sm font-semibold">{item.section}</p>
            </div>
            {item.issue && <p className="mt-2 text-sm text-muted-foreground">{item.issue}</p>}
            <p className="mt-2 text-sm">{item.suggestion}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ListCard({ title, items, tone }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => <div key={item} className="flex gap-2 text-sm"><Badge tone={tone}>Focus</Badge><span>{item}</span></div>)}
      </CardContent>
    </Card>
  );
}
