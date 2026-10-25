import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { useApp } from "../state/AppContext.jsx";

export function AnalyticsPage() {
  const { analytics } = useApp();

  if (!analytics?.hasData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-semibold">No analytics yet</h2>
          <p className="mt-2 text-muted-foreground">Complete a mock interview to see your score trajectory, technical breakdown, and communication signals.</p>
          <Button className="mt-6" asChild="true"><Link to="/interview">Start an interview</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const { progressData, technicalScores, communicationMetrics, insights } = analytics;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight) => <Insight key={insight.title} {...insight} />)}
      </div>

      <Card>
        <CardHeader><CardTitle>Score trajectory</CardTitle></CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
              <Line type="monotone" dataKey="overall" stroke="#22d3ee" strokeWidth={3} />
              <Line type="monotone" dataKey="communication" stroke="#10b981" strokeWidth={3} />
              <Line type="monotone" dataKey="coding" stroke="#f59e0b" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Technical breakdown</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={technicalScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" />
                <XAxis dataKey="skill" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                <Bar dataKey="score" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Communication signals</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {communicationMetrics.map((metric) => (
              <div key={metric.name} className="rounded-lg border bg-background/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{metric.name}</span>
                  <Badge tone={metric.value > 75 ? "success" : "warning"}>{metric.value}/100</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${metric.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Insight({ title, value, detail }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
