import mongoose from "mongoose";

const { Schema } = mongoose;

const PaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: String, required: true, unique: true },
    provider: { type: String, enum: ["demo", "razorpay"], default: "demo" },
    // Amount in INR (rupees); Razorpay itself works in paise.
    amount: Number,
    currency: { type: String, default: "INR" },
    credits: { type: Number, default: 1 },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
    paymentId: String,
    failureReason: String,
    paidAt: Date
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", PaymentSchema);
