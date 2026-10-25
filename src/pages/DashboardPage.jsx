import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Progress } from "../components/ui/Progress.jsx";
import { useApp } from "../state/AppContext.jsx";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardPage() {
  const { user, history, profile, analytics } = useApp();
  const hasData = analytics?.hasData;
  const readiness = analytics?.readiness ?? profile?.readiness ?? 0;
  const focus = analytics?.focusArea;

  const headline = !profile
    ? "Upload your resume to get an interview tailored to you."
    : !hasData
      ? `Your profile is ready. Time for your first ${profile.targetRole} mock interview.`
      : `Your next round should target ${focus || "your weakest area"}.`;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <Badge tone="info">{profile ? "AI profile ready" : "Getting started"}</Badge>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-normal md:text-5xl">{greeting()}, {user.name.split(" ")[0]}. {headline}</h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">{analytics?.nextBestAction || "InterviewIQ reads your resume, runs an adaptive interview, and turns your answers into a scored improvement plan."}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild="true">
                <Link to={profile ? "/interview" : "/resume"}>{profile ? "Start mock interview" : "Upload resume"} <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              {profile && (
                <Button variant="outline" asChild="true">
                  <Link to="/resume">Update resume</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-6xl font-semibold">{Math.round(readiness)}</p>
                <p className="mt-1 text-sm text-muted-foreground">out of 100{!hasData && profile ? " (resume estimate)" : ""}</p>
              </div>
              <Sparkles className="h-10 w-10 text-accent-foreground" />
            </div>
            <Progress value={readiness} />
            <p className="mt-4 text-sm text-muted-foreground">Placement readiness: {analytics?.placementReadiness ?? profile?.placementReadiness ?? 0}/10</p>
          </CardContent>
        </Card>
      </section>

      {hasData && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {analytics.scoreCards.map((card) => (
            <Card key={card.label}>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-semibold">{card.value}</p>
                  <Badge tone={card.delta.startsWith("-") ? "warning" : card.delta === "New" ? "info" : "success"}>{card.delta}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {hasData && (
        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader><CardTitle>Improvement over time</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.progressData}>
                  <defs>
                    <linearGradient id="score" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="overall" stroke="#22d3ee" fill="url(#score)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Skill radar</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={analytics.technicalScores}>
                  <PolarGrid stroke="rgba(148,163,184,.28)" />
                  <PolarAngleAxis dataKey="skill" stroke="#94a3b8" />
                  <Radar dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      )}

      <Card>
        <CardHeader><CardTitle>Recent interviews</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed interviews yet. Your reports will appear here.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr><th className="pb-3">Role</th><th className="pb-3">Date</th><th className="pb-3">Duration</th><th className="pb-3">Score</th><th className="pb-3">Report</th></tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-4 font-medium">{item.role}</td>
                    <td>{item.date}</td>
                    <td>{item.duration}</td>
                    <td><Badge tone={item.score >= 60 ? "success" : "warning"}>{item.score}/100</Badge></td>
                    <td><Link className="inline-flex items-center gap-2 text-accent-foreground" to={`/reports/${item.id}`}>View <CalendarCheck className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
