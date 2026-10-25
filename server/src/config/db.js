import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { env } from "./env.js";

export const EMBEDDED_PORT = 27027;
const EMBEDDED_URI = `mongodb://127.0.0.1:${EMBEDDED_PORT}/interviewiq`;
// Set by the dev script: the database runs in its own process (src/devDb.js), so wait for it instead of starting one.
const externalDb = process.argv.includes("--external-db");
let memoryServer;

export async function isEmbeddedDbRunning() {
  try {
    const probe = await mongoose.createConnection(EMBEDDED_URI, { serverSelectionTimeoutMS: 1500 }).asPromise();
    await probe.close();
    return true;
  } catch {
    return false;
  }
}

export async function startEmbeddedDb() {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const dbPath = path.join(serverRoot, ".data/db");
  fs.mkdirSync(dbPath, { recursive: true });
  console.log(`[db] Starting embedded MongoDB at ${dbPath} (first run downloads MongoDB, ~800 MB)`);
  return MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger", port: EMBEDDED_PORT },
    // Pin the binary cache so it is reused no matter which directory the server is started from.
    binary: { downloadDir: path.join(serverRoot, "node_modules/.cache/mongodb-memory-server") }
  });
}

async function embeddedUri() {
  if (externalDb) {
    // The first run can take minutes while MongoDB downloads.
    for (let attempt = 0; !(await isEmbeddedDbRunning()); attempt++) {
      if (attempt === 0) console.log("[db] Waiting for the embedded MongoDB process...");
      if (attempt > 600) throw new Error("Embedded MongoDB did not start; run `npm run db` in server/");
      await sleep(1000);
    }
    return EMBEDDED_URI;
  }

  // Standalone use (npm start, seed): reuse a running instance, otherwise own one for this process's lifetime.
  if (await isEmbeddedDbRunning()) {
    console.log("[db] Reusing running embedded MongoDB");
    return EMBEDDED_URI;
  }
  memoryServer = await startEmbeddedDb();
  return memoryServer.getUri("interviewiq");
}

export async function connectDb() {
  // No MONGODB_URI: use an embedded mongod that persists to server/.data so data survives restarts.
  const uri = env.mongoUri || (await embeddedUri());
  await mongoose.connect(uri);
  console.log("[db] Connected");
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}
