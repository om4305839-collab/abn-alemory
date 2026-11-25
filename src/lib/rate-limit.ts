import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { HttpError } from "./http";

export type RateResult = { ok: boolean; count: number; retryAfter: number };

/**
 * Fixed-window rate limiter stored in PostgreSQL (works across serverless instances).
 * A single atomic upsert avoids race conditions.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const res = await db.execute(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + (${windowSec}::int * interval '1 second'))
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now()
                      then now() + (${windowSec}::int * interval '1 second')
                      else rate_limits.reset_at end
    returning count, greatest(1, ceil(extract(epoch from (reset_at - now()))))::int as retry
  `);
  const row = res.rows[0] as { count: number; retry: number };
  if (Math.random() < 0.01) {
    // opportunistic housekeeping
    void db
      .execute(sql`delete from rate_limits where reset_at < now() - interval '1 day'`)
      .catch(() => undefined);
    void db.execute(sql`delete from sessions where absolute_expires_at < now()`).catch(() => undefined);
  }
  return { ok: row.count <= limit, count: row.count, retryAfter: row.retry };
}

/** Throws a 429 HttpError when the limit is exceeded. */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  message = "عدد كبير من المحاولات. يرجى المحاولة لاحقاً.",
): Promise<void> {
  const r = await rateLimit(key, limit, windowSec);
  if (!r.ok) {
    throw new HttpError(429, message, {}, { "Retry-After": String(r.retryAfter) });
  }
}
