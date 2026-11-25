import "server-only";
import { randomBytes } from "node:crypto";

export const isProd = process.env.NODE_ENV === "production";

let ephemeral: string | null = null;

export function hasPersistentSecret(): boolean {
  const s = process.env.APP_SECRET;
  return !!s && s.length >= 32;
}

/** Root secret used to derive all sub-keys. Never logged, never sent to the browser. */
export function appSecret(): string {
  if (hasPersistentSecret()) return process.env.APP_SECRET as string;
  if (!ephemeral) {
    ephemeral = randomBytes(48).toString("base64url");
    console.warn("[security] APP_SECRET is missing or shorter than 32 chars — using an ephemeral secret. Set APP_SECRET.");
  }
  return ephemeral;
}

export function mfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA !== "false";
}

export function supabaseConfig(): { url: string; key: string; receiptsBucket: string; mediaBucket: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    key,
    receiptsBucket: process.env.SUPABASE_RECEIPTS_BUCKET || "receipts",
    mediaBucket: process.env.SUPABASE_MEDIA_BUCKET || "site-media",
  };
}
