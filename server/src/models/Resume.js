import mongoose from "mongoose";

const { Schema } = mongoose;

const ResumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: String,
    mimeType: String,
    size: Number,
    storageKey: String,
    parsedText: String,
    parseStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    parseError: String
  },
  { timestamps: true }
);

export const Resume = mongoose.model("Resume", ResumeSchema);
