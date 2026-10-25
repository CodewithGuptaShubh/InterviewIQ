import { Router } from "express";
import { z } from "zod";
import { CandidateProfile, Report } from "../models/index.js";
import { HttpError, parseBody } from "../utils/http.js";
import { serializeProfile } from "../utils/serializers.js";

const router = Router();

const latestProfile = (userId) => CandidateProfile.findOne({ userId }).sort({ createdAt: -1 });
const latestReport = (userId) => Report.findOne({ userId }).sort({ createdAt: -1 });

router.get("/me", async (req, res) => {
  const [profile, report] = await Promise.all([latestProfile(req.user._id), latestReport(req.user._id)]);
  res.json({ profile: serializeProfile(profile, report) });
});

router.patch("/me", async (req, res) => {
  const updates = parseBody(
    z.object({
      targetRole: z.string().trim().min(2).max(100).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional()
    }),
    req.body
  );
  const profile = await latestProfile(req.user._id);
  if (!profile) throw new HttpError(404, "Upload a resume to create your profile first");
  Object.assign(profile, updates);
  await profile.save();
  res.json({ profile: serializeProfile(profile, await latestReport(req.user._id)) });
});

export default router;
