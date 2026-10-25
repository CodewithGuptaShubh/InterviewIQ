import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { CandidateProfile, Report, Resume } from "../models/index.js";
import { analyzeResume } from "../services/agents/resumeAgent.js";
import { parseResume } from "../services/resumeParser.js";
import { HttpError, parseBody } from "../utils/http.js";
import { serializeProfile } from "../utils/serializers.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

async function buildProfile(userId, resume, targetRole) {
  const { profile, generatedBy, raw } = await analyzeResume(resume.parsedText, targetRole);
  const saved = await CandidateProfile.create({
    userId,
    resumeId: resume._id,
    resumeFileName: resume.originalName,
    ...profile,
    technologies: profile.skills.filter((skill) => skill.category !== "soft_skill").map((skill) => skill.name),
    generatedBy,
    rawAiOutput: raw
  });
  const latestReport = await Report.findOne({ userId }).sort({ createdAt: -1 });
  return serializeProfile(saved, latestReport);
}

// Upload + parse + analyze in one request so the UI gets a profile back immediately.
router.post("/", upload.single("resume"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Attach a resume file in the 'resume' field");
  const { targetRole } = parseBody(z.object({ targetRole: z.string().trim().max(100).optional() }), req.body);

  const resume = await Resume.create({
    userId: req.user._id,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size
  });

  try {
    resume.parsedText = await parseResume(req.file);
    resume.parseStatus = "completed";
    await resume.save();
  } catch (error) {
    resume.parseStatus = "failed";
    resume.parseError = error.message;
    await resume.save();
    throw error.status ? error : new HttpError(422, "Could not read this resume file");
  }

  const profile = await buildProfile(req.user._id, resume, targetRole);
  res.status(201).json({ resumeId: resume._id, fileName: resume.originalName, profile });
});

router.post("/:id/analyze", async (req, res) => {
  const { targetRole } = parseBody(z.object({ targetRole: z.string().trim().max(100).optional() }), req.body);
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id, parseStatus: "completed" });
  if (!resume) throw new HttpError(404, "Resume not found");
  const profile = await buildProfile(req.user._id, resume, targetRole);
  res.json({ resumeId: resume._id, fileName: resume.originalName, profile });
});

router.get("/", async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ createdAt: -1 }).select("originalName size parseStatus createdAt");
  res.json({ resumes });
});

export default router;
