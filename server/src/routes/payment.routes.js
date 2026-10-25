import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { Payment, User } from "../models/index.js";
import { createRazorpayOrder, isValidPaymentSignature, isValidWebhookSignature, paymentProvider } from "../services/razorpay.js";
import { HttpError, parseBody } from "../utils/http.js";
import { serializeUser } from "../utils/serializers.js";

// Razorpay when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set, otherwise a demo flow that adds credits without charging.
const router = Router();

/** Mark an order paid and add its credits exactly once, even if checkout and the webhook both report it. */
async function creditOrder(filter, updates = {}) {
  const payment = await Payment.findOneAndUpdate({ ...filter, status: { $ne: "paid" } }, { status: "paid", paidAt: new Date(), failureReason: null, ...updates }, { returnDocument: "after" });
  if (!payment) return null;
  const user = await User.findByIdAndUpdate(payment.userId, { $inc: { credits: payment.credits }, plan: "paid" }, { returnDocument: "after" });
  return { payment, user };
}

const successMessage = (credits) => `Payment successful. ${credits} interview credit${credits > 1 ? "s" : ""} added.`;

router.get("/config", (_req, res) => {
  res.json({ provider: paymentProvider, keyId: paymentProvider === "razorpay" ? env.razorpayKeyId : null, pricePerCredit: env.interviewPriceInr, currency: "INR" });
});

router.post("/create-order", async (req, res) => {
  const { credits } = parseBody(z.object({ credits: z.number().int().min(1).max(10).default(1) }), req.body);
  const amount = env.interviewPriceInr * credits;

  let orderId;
  if (paymentProvider === "razorpay") {
    const order = await createRazorpayOrder({
      amountPaise: amount * 100,
      receipt: `iq_${req.user._id.toString().slice(-8)}_${Date.now()}`,
      notes: { userId: req.user._id.toString(), credits: String(credits) }
    });
    orderId = order.id;
  } else {
    orderId = `order_demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  }

  const payment = await Payment.create({ userId: req.user._id, orderId, provider: paymentProvider, amount, credits });
  res.status(201).json({
    orderId: payment.orderId,
    amount: payment.amount,
    amountPaise: payment.amount * 100,
    currency: payment.currency,
    credits,
    provider: paymentProvider,
    keyId: paymentProvider === "razorpay" ? env.razorpayKeyId : null,
    prefill: { name: req.user.name, email: req.user.email }
  });
});

router.post("/verify", async (req, res) => {
  const { orderId, paymentId, signature } = parseBody(
    z.object({ orderId: z.string().min(6), paymentId: z.string().optional(), signature: z.string().optional() }),
    req.body
  );
  const order = await Payment.findOne({ orderId, userId: req.user._id });
  if (!order) throw new HttpError(404, "Order not found");

  if (order.provider === "razorpay" && !isValidPaymentSignature(orderId, paymentId, signature)) {
    await Payment.updateOne({ _id: order._id, status: "created" }, { status: "failed", failureReason: "Signature verification failed" });
    throw new HttpError(400, "Payment verification failed. If money was deducted, it will be refunded by Razorpay.");
  }

  const result = await creditOrder({ _id: order._id }, paymentId ? { paymentId } : {});
  if (!result) {
    // Already credited (e.g. by the webhook): report success without adding credits again.
    const user = await User.findById(req.user._id);
    return res.json({ ok: true, user: serializeUser(user), message: successMessage(order.credits) });
  }
  res.json({ ok: true, user: serializeUser(result.user), message: successMessage(result.payment.credits) });
});

router.post("/failed", async (req, res) => {
  const { orderId, reason } = parseBody(z.object({ orderId: z.string().min(6), reason: z.string().max(300).optional() }), req.body);
  await Payment.updateOne({ orderId, userId: req.user._id, status: "created" }, { status: "failed", failureReason: reason || "Payment failed" });
  res.json({ ok: true });
});

router.get("/history", async (req, res) => {
  const payments = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).select("orderId provider amount currency credits status paymentId failureReason paidAt createdAt");
  res.json({ payments });
});

/**
 * Razorpay webhook (payment.captured / order.paid). Mounted without auth and with the raw body,
 * so the signature can be checked. Credits the order if the browser never called /verify.
 */
export async function razorpayWebhook(req, res) {
  if (!env.razorpayWebhookSecret) return res.status(501).json({ error: "Webhook secret not configured" });
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!isValidWebhookSignature(rawBody, req.headers["x-razorpay-signature"])) return res.status(400).json({ error: "Invalid signature" });

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id || event.payload?.order?.entity?.id;
  if (orderId && ["payment.captured", "order.paid"].includes(event.event)) {
    const result = await creditOrder({ orderId, provider: "razorpay" }, payment?.id ? { paymentId: payment.id } : {});
    if (result) console.log(`[razorpay] Webhook credited order ${orderId}`);
  } else if (orderId && event.event === "payment.failed") {
    await Payment.updateOne({ orderId, status: "created" }, { status: "failed", failureReason: payment?.error_description || "Payment failed" });
  }
  res.json({ ok: true });
}

export default router;
