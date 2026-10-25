import mongoose from "mongoose";

const { Schema } = mongoose;

const ReportSchema = new Schema(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    overallScore: Number,
    hiringReadinessScore: Number,
    placementReadiness: Number,
    technicalScore: Number,
    behavioralScore: Number,
    communicationScore: Number,
    codingScore: Number,
    consistencyScore: Number,
    technicalScores: [{ _id: false, skill: String, score: Number }],
    behavioralScores: { teamwork: Number, leadership: Number, problemSolving: Number, ownership: Number },
    communicationScores: {
      clarity: Number,
      confidence: Number,
      structure: Number,
      pace: Number,
      fillers: Number,
      fillerWordRate: Number,
      speakingPace: Number
    },
    codingScores: { logic: Number, efficiency: Number, correctness: Number, readability: Number },
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
    personalizedRoadmap: [{ _id: false, area: String, priority: String, actions: [String], estimatedDays: Number }],
    questionAnalysis: [
      { _id: false, round: String, question: String, answer: String, score: Number, verdict: String, feedback: String, idealAnswer: String }
    ],
    summary: String,
    generatedBy: String,
    rawAiOutput: Schema.Types.Mixed
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", ReportSchema);
