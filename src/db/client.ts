import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __novaPool?: Pool; __novaDb?: Db };

export function getPool(): Pool {
  if (!globalForDb.__novaPool) {
    globalForDb.__novaPool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  }
  return globalForDb.__novaPool;
}

export function getDb(): Db {
  if (!globalForDb.__novaDb) {
    globalForDb.__novaDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__novaDb;
}

export async function closeDb() {
  await globalForDb.__novaPool?.end();
  globalForDb.__novaPool = undefined;
  globalForDb.__novaDb = undefined;
}

export { schema };
