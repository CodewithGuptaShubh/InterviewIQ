import mongoose from "mongoose";

const { Schema } = mongoose;

const CodingSubmissionSchema = new Schema(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: "Interview", required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    problemId: String,
    language: { type: String, enum: ["javascript", "python", "java", "cpp", "c"], default: "javascript" },
    code: String,
    attempts: { type: Number, default: 0 },
    executionResult: {
      status: String,
      stdout: String,
      stderr: String,
      runtimeMs: Number,
      testCasesPassed: Number,
      totalTestCases: Number
    },
    aiEvaluation: {
      logic: Number,
      efficiency: Number,
      correctness: Number,
      readability: Number,
      complexity: String,
      feedback: String
    }
  },
  { timestamps: true }
);

export const CodingSubmission = mongoose.model("CodingSubmission", CodingSubmissionSchema);
