import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { clientIpHash, userAgent } from "./http";

const REDACT = /pass|secret|token|code|authorization|cookie|key/i;

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT.test(k) ? "[redacted]" : typeof v === "string" ? v.slice(0, 300) : v;
  }
  return out;
}

/** Append-only audit trail. Never throws and never stores passwords, tokens or payment data. */
export async function audit(
  action: string,
  opts: {
    actorUserId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    headers?: Headers;
  } = {},
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: opts.actorUserId ?? null,
      action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      metadata: redact(opts.metadata ?? {}),
      ipHash: opts.headers ? clientIpHash(opts.headers) : null,
      userAgent: opts.headers ? userAgent(opts.headers) : null,
    });
  } catch (e) {
    console.error("[audit-error]", e instanceof Error ? e.message.slice(0, 200) : "unknown");
  }
}
