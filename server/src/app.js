import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import paymentRoutes, { razorpayWebhook } from "./routes/payment.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import reportRoutes from "./routes/report.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import speechRoutes from "./routes/speech.routes.js";
import { aiProvider } from "./services/llm.js";
import { paymentProvider } from "./services/razorpay.js";
import { speechProvider } from "./services/speech.js";

const limiter = (windowMinutes, limit) =>
  rateLimit({ windowMs: windowMinutes * 60 * 1000, limit, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests, please slow down" } });

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      // The frontend loads Razorpay Checkout, the Monaco editor (CDN) and Google sign-in from other origins,
      // which the default Content-Security-Policy would block.
      contentSecurityPolicy: false,
      // Google sign-in and Razorpay use popups that must be able to message this page.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
    })
  );
  app.use(
    cors((req, callback) => {
      const origin = req.header("Origin");
      // Development allows any origin (Vite on localhost/LAN). Production allows CLIENT_URL and the app's own domain,
      // so a single-service deploy works without configuring CLIENT_URL.
      const sameHost = origin && new URL(origin).host === req.header("Host");
      const allowed = !env.isProd || !origin || sameHost || env.clientUrls.includes(origin);
      callback(null, { origin: allowed, credentials: true });
    })
  );
  // Webhooks need the exact raw body to verify Razorpay's signature, so this is registered before the JSON parser.
  app.post("/api/payments/webhook", express.raw({ type: "*/*", limit: "100kb" }), razorpayWebhook);
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected", ai: aiProvider, speech: speechProvider, payments: paymentProvider });
  });

  app.use("/api/auth", limiter(15, 50), authRoutes);
  app.use("/api/resumes", requireAuth, limiter(15, 20), resumeRoutes);
  app.use("/api/profiles", requireAuth, profileRoutes);
  app.use("/api/interviews", requireAuth, limiter(1, 40), interviewRoutes);
  app.use("/api/reports", requireAuth, reportRoutes);
  app.use("/api/payments", requireAuth, limiter(15, 30), paymentRoutes);
  app.use("/api/speech", requireAuth, limiter(1, 30), speechRoutes);

  // Serve the built frontend (npm run build → dist/) so the whole app deploys as one service.
  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
  if (fs.existsSync(path.join(distDir, "index.html"))) {
    app.use(express.static(distDir, { index: false, maxAge: "1h" }));
    // Client-side routes (/login, /reports/:id, ...) all load index.html; unknown /api routes still 404.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
