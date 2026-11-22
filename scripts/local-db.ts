/**
 * Starts an embedded PostgreSQL for local development (no Homebrew/Docker needed).
 * Data lives in .data/pg (git-ignored). Stop with Ctrl+C.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.LOCAL_DB_PORT ?? 54329);
const password = process.env.LOCAL_DB_PASSWORD;
if (!password || password.startsWith("REPLACE")) {
  console.error("Set LOCAL_DB_PASSWORD in .env (see .env.example) before running db:local.");
  process.exit(1);
}
const dataDir = path.resolve(".data/pg");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "nova",
  password,
  port,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("nova_os");
console.log(`PostgreSQL ready: postgres://nova:***@localhost:${port}/nova_os  (Ctrl+C to stop)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
