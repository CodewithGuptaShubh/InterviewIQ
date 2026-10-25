import mongoose from "mongoose";

const { Schema } = mongoose;

const CandidateProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume" },
    resumeFileName: String,
    targetRole: String,
    seniority: { type: String, enum: ["student", "fresher", "junior", "mid", "senior"], default: "fresher" },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
    readinessEstimate: { type: Number, default: 50 },
    skills: [{ _id: false, name: String, category: String, confidence: Number }],
    technologies: [String],
    projects: [
      {
        _id: false,
        title: String,
        description: String,
        technologies: [String],
        impact: String,
        questionsHint: [String]
      }
    ],
    experience: [{ _id: false, company: String, role: String, startDate: String, endDate: String, summary: String }],
    education: [{ _id: false, institution: String, degree: String, year: String, score: String }],
    certifications: [String],
    strengths: [String],
    gaps: [String],
    resumeScore: Number,
    suggestions: [{ _id: false, section: String, issue: String, suggestion: String, priority: String }],
    generatedBy: String,
    rawAiOutput: Schema.Types.Mixed
  },
  { timestamps: true }
);

export const CandidateProfile = mongoose.model("CandidateProfile", CandidateProfileSchema);
