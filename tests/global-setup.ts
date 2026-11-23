/**
 * Boots an embedded PostgreSQL for the test run unless TEST_DATABASE_URL is provided (CI uses a service container).
 * Applies migrations once; individual tests truncate what they need.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let stop: (() => Promise<void>) | undefined;
  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const dir = mkdtempSync(path.join(os.tmpdir(), "nova-test-pg-"));
    const port = 54000 + Math.floor(Math.random() * 900);
    const pg = new EmbeddedPostgres({ databaseDir: dir, user: "test", password: "test", port, persistent: false, onLog: () => {} });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("nova_test");
    url = `postgres://test:test@localhost:${port}/nova_test`;
    stop = async () => {
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    };
  }
  process.env.DATABASE_URL = url;
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"], {
    env: { ...process.env, DATABASE_URL: url, BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234" },
    stdio: "inherit",
  });
  project.provide("databaseUrl", url);
  return async () => {
    await stop?.();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
