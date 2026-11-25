import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __kaPgPool?: Pool;
};

// Small pool: serverless friendly (use the Supabase pooler URL on Vercel).
export const pool =
  globalForDb.__kaPgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    statement_timeout: 15_000,
  });

globalForDb.__kaPgPool = pool;

export const db = drizzle(pool, { schema });
