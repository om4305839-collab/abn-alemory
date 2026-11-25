// Pure helpers (no server-only import) so they can be used by src/proxy.ts and route handlers.

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function allowedExtraOrigins(): Set<string> {
  const out = new Set<string>();
  const add = (v?: string) => {
    if (!v) return;
    try {
      out.add(new URL(v.trim()).origin);
    } catch {
      /* ignore malformed value */
    }
  };
  add(process.env.APP_URL);
  for (const o of (process.env.ALLOWED_ORIGINS ?? "").split(",")) add(o);
  return out;
}

/**
 * CSRF / CORS defence for state-changing requests (OWASP "Verify origin with standard headers").
 * - Browser requests always carry `Origin` on cross-origin and on same-origin POST/PUT/PATCH/DELETE.
 * - The Origin host must equal the Host the request was addressed to, or be explicitly allow-listed.
 * - Requests without Origin are only accepted when Fetch-Metadata says same-origin / user-initiated.
 */
export function isTrustedOrigin(headers: Headers): boolean {
  // Fetch Metadata (set by the browser, cannot be forged by web pages) is authoritative when present:
  // it keeps working behind proxies that rewrite the Host header.
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  if (!origin) {
    const site = headers.get("sec-fetch-site");
    return site === "same-origin" || site === "none";
  }
  if (origin === "null") return false;
  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    return allowedExtraOrigins().has(o.origin);
  } catch {
    return false;
  }
}
