import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Progress } from "../components/ui/Progress.jsx";

export function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setReport(null);
    setError("");
    api.getReport(id).then((data) => setReport(data.report)).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <Card><CardContent className="p-8 text-center">
        <p className="text-lg font-semibold">{error}</p>
        <Button className="mt-4" variant="outline" asChild><Link to="/">Back to dashboard</Link></Button>
      </CardContent></Card>
    );
  }
  if (!report) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-accent-foreground" /></div>;

  const { interview } = report;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
      </Button>
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <Badge tone="success">Completed</Badge>
            <h2 className="mt-4 text-3xl font-semibold md:text-5xl">{interview.role}</h2>
            <p className="mt-3 text-muted-foreground">{interview.date} • {interview.duration} • Report ID {interview.id}</p>
            {report.summary && <p className="mt-4 max-w-2xl text-sm leading-6">{report.summary}</p>}
          </div>
          <div className="rounded-lg border bg-background/60 p-5 text-center">
            <p className="text-sm text-muted-foreground">Overall score</p>
            <p className="mt-2 text-6xl font-semibold">{report.overallScore}</p>
            <p className="mt-2 text-xs text-muted-foreground">Hiring readiness {report.hiringReadiness}/100</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {report.scores.map(({ label, value }) => (
          <Card key={label}><CardContent><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p><Progress value={value} /></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ListCard title="Strengths" items={report.strengths} tone="success" />
        <ListCard title="Weaknesses" items={report.weaknesses} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Detailed score evidence</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {report.technicalScores.map((item) => (
              <div key={item.skill}>
                <div className="mb-2 flex justify-between text-sm"><span>{item.skill}</span><span>{item.score}/100</span></div>
                <Progress value={item.score} />
              </div>
            ))}
            {report.technicalScores.length === 0 && <p className="text-sm text-muted-foreground">Not enough technical answers to score individual skills.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Coach recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {report.roadmap.map((item) => (
              <div key={item.area} className="rounded-lg border bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.area}</p>
                  <div className="flex gap-2">
                    <Badge>{item.days} days</Badge>
                    <Badge tone={item.priority === "High" ? "warning" : "info"}>{item.priority}</Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {item.actions.map((action) => (
                    <p key={action} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> {action}</p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {report.questionAnalysis.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Question-by-question analysis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {report.questionAnalysis.map((item, index) => (
              <details key={index} className="group rounded-lg border bg-background/50 p-4" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Q{index + 1} • {item.round}</p>
                    <p className="mt-1 text-sm font-medium">{item.question}</p>
                  </div>
                  <Badge className="shrink-0" tone={item.score >= 75 ? "success" : item.score >= 50 ? "info" : "warning"}>{item.score}/100</Badge>
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-md bg-muted p-3"><p className="mb-1 text-xs font-semibold text-muted-foreground">Your answer</p>{item.answer}</div>
                  <p><span className="font-semibold">Feedback: </span>{item.feedback}</p>
                  <p className="text-muted-foreground"><span className="font-semibold text-foreground">A stronger answer: </span>{item.idealAnswer}</p>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Communication notes</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {report.communicationMetrics.map((item) => <div key={item.name} className="rounded-md border bg-background/50 p-3 text-sm"><p className="text-muted-foreground">{item.name}</p><p className="mt-2 text-xl font-semibold">{item.value}</p></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function ListCard({ title, items, tone }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => <div key={item} className="flex gap-2 text-sm"><Badge tone={tone} className="shrink-0">{tone === "success" ? "Strong" : "Improve"}</Badge><span>{item}</span></div>)}
      </CardContent>
    </Card>
  );
}
