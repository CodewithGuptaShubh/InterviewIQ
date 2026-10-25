import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.warn(`[api] Node.js ${process.versions.node} detected. Use Node 20.19+ or 22+ (the frontend build requires it).`);
}

// In production the API also serves the website. If the host skipped `npm run build`, build it once now.
if (env.isProd && !fs.existsSync(path.join(projectRoot, "dist/index.html"))) {
  const viteBin = path.join(projectRoot, "node_modules/vite/bin/vite.js");
  if (fs.existsSync(viteBin)) {
    console.log("[api] dist/ not found; building the frontend (one time)...");
    const result = spawnSync(process.execPath, [viteBin, "build"], { cwd: projectRoot, stdio: "inherit" });
    if (result.status !== 0) console.error("[api] Frontend build failed; the API will run without the website. Run `npm run build` and check the error above.");
  } else {
    console.error("[api] dist/ not found and Vite is not installed; run `npm install && npm run build` in the project root.");
  }
}

const { createApp } = await import("./app.js");
const { connectDb, disconnectDb } = await import("./config/db.js");
const { aiProvider } = await import("./services/llm.js");

try {
  await connectDb();
} catch (error) {
  console.error(`[db] Could not connect to MongoDB: ${error.message}`);
  if (env.mongoUri.includes("mongodb.net")) {
    console.error("[db] On MongoDB Atlas, allow this server's IP: Atlas → Network Access → Add IP Address → 0.0.0.0/0. Also check the username/password in MONGODB_URI.");
  }
  process.exit(1);
}

const server = createApp().listen(env.port, () => {
  console.log(`[api] InterviewIQ API listening on http://localhost:${env.port} (AI: ${aiProvider})`);
});

server.on("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[api] Port ${env.port} is already in use. Another copy of the API is probably running; stop it (Ctrl+C in its terminal) and try again.`);
  } else {
    console.error("[api] Server error:", error);
  }
  await disconnectDb().catch(() => {});
  process.exit(1);
});

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
