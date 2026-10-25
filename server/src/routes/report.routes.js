import { Router } from "express";
import { CandidateProfile, Interview, Report } from "../models/index.js";
import { HttpError } from "../utils/http.js";
import { communicationMetricsFrom, serializeReport } from "../utils/serializers.js";

const router = Router();

const shortDate = (date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit" });

function delta(latest, previous) {
  if (previous == null) return "New";
  const diff = Math.round(latest - previous);
  return diff >= 0 ? `+${diff}` : `${diff}`;
}

router.get("/analytics/summary", async (req, res) => {
  const [reports, profile] = await Promise.all([
    Report.find({ userId: req.user._id }).sort({ createdAt: 1 }),
    CandidateProfile.findOne({ userId: req.user._id }).sort({ createdAt: -1 })
  ]);
  const latest = reports.at(-1);
  const previous = reports.at(-2);

  if (!latest) {
    return res.json({
      hasData: false,
      readiness: profile?.readinessEstimate ?? 0,
      placementReadiness: profile ? Math.round(profile.readinessEstimate) / 10 : 0,
      scoreCards: [],
      progressData: [],
      technicalScores: [],
      communicationMetrics: [],
      insights: [],
      focusArea: profile?.gaps?.[0] || null,
      nextBestAction: profile ? "Start your first mock interview to get a scored report." : "Upload your resume to build your candidate profile."
    });
  }

  const card = (label, key, tone) => ({ label, value: latest[key], delta: delta(latest[key], previous?.[key]), tone });

  const sortedSkills = [...(latest.technicalScores || [])].sort((a, b) => b.score - a.score);
  const first = reports[0];
  const gains = [
    ["Technical", "technicalScore"],
    ["Communication", "communicationScore"],
    ["Coding", "codingScore"],
    ["Behavioral", "behavioralScore"]
  ].map(([label, key]) => ({ label, gain: latest[key] - first[key] })).sort((a, b) => b.gain - a.gain);

  const insights = [
    sortedSkills[0] && { title: "Best area", value: sortedSkills[0].skill, detail: `${sortedSkills[0].score}/100 technical depth` },
    reports.length > 1
      ? { title: "Fastest gain", value: gains[0].label, detail: `${gains[0].gain >= 0 ? "+" : ""}${gains[0].gain} points in ${reports.length} rounds` }
      : { title: "Interviews done", value: String(reports.length), detail: "Complete another to track gains" },
    { title: "Risk area", value: latest.personalizedRoadmap?.[0]?.area || sortedSkills.at(-1)?.skill || "—", detail: latest.weaknesses?.[0] || "Keep practicing" }
  ].filter(Boolean);

  res.json({
    hasData: true,
    readiness: latest.hiringReadinessScore,
    placementReadiness: latest.placementReadiness,
    scoreCards: [
      card("Overall Score", "overallScore", "cyan"),
      card("Hiring Readiness", "hiringReadinessScore", "emerald"),
      card("Technical", "technicalScore", "amber"),
      card("Communication", "communicationScore", "blue")
    ],
    progressData: reports.slice(-10).map((report) => ({
      name: shortDate(report.createdAt),
      overall: report.overallScore,
      technical: report.technicalScore,
      communication: report.communicationScore,
      coding: report.codingScore
    })),
    technicalScores: latest.technicalScores || [],
    communicationMetrics: communicationMetricsFrom(latest),
    insights,
    focusArea: latest.personalizedRoadmap?.[0]?.area || null,
    nextBestAction: latest.personalizedRoadmap?.[0]?.actions?.[0] || latest.recommendations?.[0] || "Take another mock interview."
  });
});

router.get("/:interviewId", async (req, res) => {
  const [report, interview] = await Promise.all([
    Report.findOne({ interviewId: req.params.interviewId, userId: req.user._id }),
    Interview.findOne({ _id: req.params.interviewId, userId: req.user._id })
  ]);
  if (!report || !interview) throw new HttpError(404, "Report not found");
  res.json({ report: serializeReport(report, interview) });
});

export default router;
