import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { aiProvider } from "./services/llm.js";

await connectDb();

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
