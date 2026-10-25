import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export const paymentProvider = env.razorpayKeyId && env.razorpayKeySecret ? "razorpay" : "demo";

/** Create an order with Razorpay's Orders API. `amountPaise` is in the smallest currency unit. */
export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
    signal: AbortSignal.timeout(15000)
  }).catch((error) => {
    throw new HttpError(502, `Could not reach Razorpay: ${error.message}`);
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("[razorpay] Order creation failed:", response.status, data.error?.description);
    throw new HttpError(502, response.status === 401 ? "Razorpay keys are invalid" : `Razorpay order failed: ${data.error?.description || response.status}`);
  }
  return data;
}

/** Constant-time comparison of a hex HMAC-SHA256 signature. */
export function isValidSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checkout signature: HMAC(order_id + "|" + payment_id) with the key secret. */
export const isValidPaymentSignature = (orderId, paymentId, signature) =>
  isValidSignature(`${orderId}|${paymentId}`, signature, env.razorpayKeySecret);

/** Webhook signature: HMAC(raw request body) with the webhook secret. */
export const isValidWebhookSignature = (rawBody, signature) => isValidSignature(rawBody, signature, env.razorpayWebhookSecret);
