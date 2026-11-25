import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminRoles, sessions, users, type AdminRole } from "@/db/schema";
import { randomToken, sha256Hex } from "./crypto";
import { isProd, mfaRequired } from "./env";
import { HttpError, clientIpHash, userAgent } from "./http";

// ───────────── RBAC
export type Permission =
  | "orders.read"
  | "orders.update"
  | "receipts.read"
  | "products.manage"
  | "settings.manage"
  | "payments.manage"
  | "audit.read";

const PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    "orders.read",
    "orders.update",
    "receipts.read",
    "products.manage",
    "settings.manage",
    "payments.manage",
    "audit.read",
  ]),
  manager: new Set<Permission>([
    "orders.read",
    "orders.update",
    "receipts.read",
    "products.manage",
    "settings.manage",
  ]),
  staff: new Set<Permission>(["orders.read", "orders.update", "receipts.read"]),
};

export const can = (role: AdminRole | null | undefined, perm: Permission) =>
  !!role && PERMISSIONS[role].has(perm);

// ───────────── sessions
const IDLE_MS = 2 * 60 * 60 * 1000; // 2h idle timeout
const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12h hard limit
const PENDING_MS = 10 * 60 * 1000; // password OK, MFA pending

const secureCookiesEnabled = () => isProd && process.env.INSECURE_COOKIES !== "true";
export const sessionCookieName = () => (secureCookiesEnabled() ? "__Host-ka_session" : "ka_session");

export function sessionCookie(token: string, maxAgeSec: number): string {
  const parts = [`${sessionCookieName()}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSec}`];
  if (secureCookiesEnabled()) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return sessionCookie("", 0);
}

function readCookie(h: Headers, name: string): string | undefined {
  const raw = h.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole | null;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  mfaVerified: boolean;
  sessionId: string;
};

export async function createSession(userId: string, mfaVerified: boolean, h: Headers) {
  const token = randomToken(32);
  const now = Date.now();
  const ttl = mfaVerified ? IDLE_MS : PENDING_MS;
  await db.insert(sessions).values({
    id: sha256Hex(token),
    userId,
    mfaVerified,
    ipHash: clientIpHash(h),
    userAgent: userAgent(h),
    expiresAt: new Date(now + ttl),
    absoluteExpiresAt: new Date(now + (mfaVerified ? ABSOLUTE_MS : PENDING_MS)),
  });
  return { token, maxAgeSec: Math.floor(ttl / 1000) };
}

/** Promotes a pending (password-only) session after a valid MFA code. */
export async function promoteSession(sessionId: string) {
  const now = Date.now();
  await db
    .update(sessions)
    .set({
      mfaVerified: true,
      expiresAt: new Date(now + IDLE_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_MS),
      lastSeenAt: new Date(now),
    })
    .where(eq(sessions.id, sessionId));
  return Math.floor(IDLE_MS / 1000);
}

export async function destroySession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function destroyOtherSessions(userId: string, keepSessionId: string) {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}

export async function getAuthFromHeaders(h: Headers): Promise<AuthContext | null> {
  const token = readCookie(h, sessionCookieName());
  if (!token || token.length < 20 || token.length > 128) return null;
  const id = sha256Hex(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      mfaVerified: sessions.mfaVerified,
      expiresAt: sessions.expiresAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
      mfaEnabled: users.mfaEnabled,
      mustChangePassword: users.mustChangePassword,
      role: adminRoles.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(adminRoles, eq(adminRoles.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now || row.absoluteExpiresAt.getTime() <= now || !row.isActive) {
    await destroySession(id);
    return null;
  }
  // sliding idle expiry (bounded by the absolute lifetime), written at most once a minute
  if (row.mfaVerified && now - row.lastSeenAt.getTime() > 60_000) {
    const next = Math.min(now + IDLE_MS, row.absoluteExpiresAt.getTime());
    await db
      .update(sessions)
      .set({ lastSeenAt: sql`now()`, expiresAt: new Date(next) })
      .where(eq(sessions.id, id));
  }
  return {
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    mfaEnabled: row.mfaEnabled,
    mustChangePassword: row.mustChangePassword,
    mfaVerified: row.mfaVerified,
    sessionId: row.sessionId,
  };
}

// ───────────── server-side guards (pages)
export async function getPageAuth(): Promise<AuthContext | null> {
  return getAuthFromHeaders(await headers());
}

/** Page guard — authorisation is enforced on the server, not by hiding links. */
export async function requireAdminPage(permission?: Permission): Promise<AuthContext & { role: AdminRole }> {
  const auth = await getPageAuth();
  if (!auth || !auth.role) redirect("/admin/login");
  if (!auth.mfaVerified) redirect("/admin/mfa");
  if (auth.mustChangePassword || (mfaRequired() && !auth.mfaEnabled)) redirect("/admin/security");
  if (permission && !can(auth.role, permission)) redirect("/admin?denied=1");
  return { ...auth, role: auth.role };
}

// ───────────── server-side guards (API)
export async function authApi(
  req: Request,
  opts: { permission?: Permission; allowMfaSetup?: boolean } = {},
): Promise<AuthContext & { role: AdminRole }> {
  const auth = await getAuthFromHeaders(req.headers);
  if (!auth || !auth.role || !auth.mfaVerified) throw new HttpError(401, "غير مصرح");
  if ((auth.mustChangePassword || (mfaRequired() && !auth.mfaEnabled)) && !opts.allowMfaSetup) {
    throw new HttpError(403, "يجب تغيير كلمة المرور وتفعيل المصادقة الثنائية أولاً");
  }
  if (opts.permission && !can(auth.role, opts.permission)) throw new HttpError(403, "ليست لديك صلاحية لهذا الإجراء");
  return { ...auth, role: auth.role };
}
