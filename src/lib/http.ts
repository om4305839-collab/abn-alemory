import "server-only";
import { ZodError } from "zod";
import { isTrustedOrigin, SAFE_METHODS } from "./origin";
import { hashIp } from "./crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    public publicMessage: string,
    public extra: Record<string, unknown> = {},
    public headers: Record<string, string> = {},
  ) {
    super(publicMessage);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      ...headers,
    },
  });
}

/**
 * Client IP. On Vercel `x-real-ip` / `x-forwarded-for` are set by the platform edge and can't be spoofed.
 * Behind other proxies we use the LAST x-forwarded-for hop (appended by the nearest trusted proxy).
 */
export function clientIp(h: Headers): string {
  const real = h.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 64);
  }
  return "unknown";
}

export const clientIpHash = (h: Headers) => hashIp(clientIp(h));

export const userAgent = (h: Headers) => (h.get("user-agent") ?? "").slice(0, 200);

export async function readBodyLimited(req: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, "حجم الطلب كبير جداً");
  }
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, "حجم الطلب كبير جداً");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("application/json")) throw new HttpError(415, "نوع المحتوى غير مدعوم");
  const buf = await readBodyLimited(req, maxBytes);
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw new HttpError(400, "صيغة الطلب غير صحيحة");
  }
}

export async function readMultipart(req: Request, maxBytes: number): Promise<FormData> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) throw new HttpError(415, "نوع المحتوى غير مدعوم");
  const buf = await readBodyLimited(req, maxBytes);
  try {
    return await new Response(new Uint8Array(buf), { headers: { "content-type": ct } }).formData();
  } catch {
    throw new HttpError(400, "صيغة الطلب غير صحيحة");
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps every API route:
 *  - CSRF/CORS: state-changing requests must come from a trusted Origin
 *  - uniform JSON errors, never leaking stack traces or internals
 *  - no-store caching
 */
export function api<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (!SAFE_METHODS.has(req.method) && !isTrustedOrigin(req.headers)) {
        throw new HttpError(403, "طلب غير مسموح");
      }
      const res = await handler(req, ctx);
      if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.publicMessage, ...e.extra }, e.status, e.headers);
      }
      if (e instanceof ZodError) {
        const fields = Array.from(new Set(e.issues.map((i) => i.path.join(".") || "_")));
        return json({ error: "بيانات غير صالحة. يرجى مراجعة الحقول.", fields }, 400);
      }
      // Log only a short, non-sensitive description (no bodies, no credentials)
      console.error("[api-error]", e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "unknown");
      return json({ error: "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً." }, 500);
    }
  };
}
