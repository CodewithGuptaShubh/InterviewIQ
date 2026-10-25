import bcrypt from "bcryptjs";
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { User } from "../models/index.js";
import { HttpError, parseBody } from "../utils/http.js";
import { serializeUser } from "../utils/serializers.js";

const router = Router();
const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

const signupSchema = z.object({
  name: z.string().trim().min(2, "must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("must be a valid email"),
  password: z.string().min(8, "must be at least 8 characters").max(128)
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("must be a valid email"),
  password: z.string().min(1, "is required")
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  title: z.string().trim().max(100).optional(),
  preferences: z.array(z.string().max(60)).max(20).optional()
});

function authResponse(user) {
  return { token: signToken(user), user: serializeUser(user) };
}

router.post("/signup", async (req, res) => {
  const { name, email, password } = parseBody(signupSchema, req.body);
  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), lastLoginAt: new Date() });
  res.status(201).json(authResponse(user));
});

router.post("/login", async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body);
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, user && !user.passwordHash ? "This account uses Google sign-in" : "Invalid email or password");
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json(authResponse(user));
});

router.post("/google", async (req, res) => {
  if (!googleClient) throw new HttpError(501, "Google sign-in is not configured on the server");
  const { credential } = parseBody(z.object({ credential: z.string().min(10) }), req.body);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Google sign-in failed, please try again");
  }
  if (!payload?.email || !payload.email_verified) throw new HttpError(401, "Google account email is not verified");

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  if (!user) user = new User({ name: payload.name || email.split("@")[0], email });
  user.googleId = payload.sub;
  user.avatarUrl ||= payload.picture;
  user.lastLoginAt = new Date();
  await user.save();
  res.json(authResponse(user));
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

router.patch("/me", requireAuth, async (req, res) => {
  const updates = parseBody(updateSchema, req.body);
  if (updates.email && updates.email !== req.user.email && (await User.exists({ email: updates.email }))) {
    throw new HttpError(409, "That email is already in use");
  }
  Object.assign(req.user, updates);
  await req.user.save();
  res.json({ user: serializeUser(req.user) });
});

// Tokens are stateless JWTs; the client discards its token. Kept for API completeness.
router.post("/logout", requireAuth, (_req, res) => {
  res.json({ ok: true });
});

export default router;
