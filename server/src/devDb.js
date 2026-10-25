// Standalone embedded MongoDB for local development, persisted to server/.data/db.
// Runs as its own process so API restarts (node --watch) never stop the database.
import { setTimeout as sleep } from "node:timers/promises";
import { EMBEDDED_PORT, isEmbeddedDbRunning, startEmbeddedDb } from "./config/db.js";

async function run() {
  // Another process already owns the database: watch it, and take over if it goes away.
  if (await isEmbeddedDbRunning()) {
    console.log(`[db] Embedded MongoDB is already running on port ${EMBEDDED_PORT}; reusing it.`);
    while (await isEmbeddedDbRunning()) await sleep(3000);
    console.log("[db] The other MongoDB process stopped; starting our own.");
  }

  const server = await startEmbeddedDb();
  console.log(`[db] Embedded MongoDB ready on port ${EMBEDDED_PORT}`);
  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

await run();
