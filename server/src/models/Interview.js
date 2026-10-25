import mongoose from "mongoose";

const { Schema } = mongoose;

const InterviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    candidateProfileId: { type: Schema.Types.ObjectId, ref: "CandidateProfile", required: true },
    title: String,
    targetRole: String,
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    status: { type: String, enum: ["created", "in_progress", "completed", "cancelled", "failed"], default: "created" },
    mode: { type: String, enum: ["text", "voice"], default: "text" },
    isPaid: { type: Boolean, default: false },
    roadmap: [
      {
        _id: false,
        round: String,
        goal: String,
        estimatedQuestions: Number,
        completed: { type: Boolean, default: false }
      }
    ],
    currentRound: String,
    conversationDone: { type: Boolean, default: false },
    codingProblemId: String,
    startedAt: Date,
    completedAt: Date,
    durationSeconds: Number
  },
  { timestamps: true }
);

export const Interview = mongoose.model("Interview", InterviewSchema);
