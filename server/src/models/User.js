import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: String,
    title: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "paid"], default: "free" },
    credits: { type: Number, default: 0, min: 0 },
    freeInterviewsUsed: { type: Number, default: 0, min: 0 },
    preferences: { type: [String], default: ["Include coding round", "Behavioral follow-ups", "Detailed reports"] },
    lastLoginAt: Date
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
