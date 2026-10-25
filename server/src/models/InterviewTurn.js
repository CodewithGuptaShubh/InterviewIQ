import mongoose from "mongoose";

const { Schema } = mongoose;

const InterviewTurnSchema = new Schema(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: "Interview", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    round: String,
    sequence: Number,
    question: String,
    intent: String,
    answerTranscript: String,
    answerDurationSeconds: Number,
    answeredAt: Date,
    internalEvaluation: {
      correctness: Number,
      depth: Number,
      clarity: Number,
      confidence: Number,
      followUpNeeded: Boolean,
      notes: String
    },
    communication: Schema.Types.Mixed
  },
  { timestamps: true }
);

InterviewTurnSchema.index({ interviewId: 1, sequence: 1 }, { unique: true });

export const InterviewTurn = mongoose.model("InterviewTurn", InterviewTurnSchema);
