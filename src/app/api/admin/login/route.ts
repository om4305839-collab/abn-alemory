import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminRoles, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, sessionCookie } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { mfaRequired } from "@/lib/env";
import { api, clientIp, clientIpHash, HttpError, json, readJson } from "@/lib/http";
import { dummyVerify, verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCaptcha } from "@/lib/turnstile";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const GENERIC = "بيانات الدخول غير صحيحة أو الحساب مقفل مؤقتاً";
const MAX_FAILS = 10;
const LOCK_MINUTES = 30;

export const POST = api(async (req) => {
  const ipHash = clientIpHash(req.headers);

  // Layered throttling: per-IP, global (credential stuffing from many IPs), and per-account.
  await enforceRateLimit(`login:ip:${ipHash}`, 10, 900, "محاولات تسجيل دخول كثيرة. حاول لاحقاً.");
  await enforceRateLimit("login:global", 300, 600, "محاولات تسجيل دخول كثيرة. حاول لاحقاً.");

  const parsed = loginSchema.safeParse(await readJson(req, 4096));
  if (!parsed.success) throw new HttpError(401, GENERIC);
  const { email, password, turnstileToken } = parsed.data;
  await requireCaptcha(turnstileToken, clientIp(req.headers));

  const emailKey = sha256Hex(email).slice(0, 32);
  await enforceRateLimit(`login:acct:${emailKey}`, 8, 900, "محاولات تسجيل دخول كثيرة. حاول لاحقاً.");

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      mfaEnabled: users.mfaEnabled,
      mustChangePassword: users.mustChangePassword,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
      role: adminRoles.role,
    })
    .from(users)
    .leftJoin(adminRoles, eq(adminRoles.userId, users.id))
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const locked = !!user?.lockedUntil && user.lockedUntil.getTime() > Date.now();
  if (!user || !user.isActive || !user.role || locked) {
    await dummyVerify(password); // equalise timing; never reveal why
    await audit("auth.login_failed", {
      actorUserId: user?.id ?? null,
      metadata: { reason: !user ? "unknown_user" : locked ? "locked" : "inactive_or_no_role", emailKey },
      headers: req.headers,
    });
    throw new HttpError(401, GENERIC);
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const fails = user.failedLoginCount + 1;
    const lock = fails >= MAX_FAILS;
    await db
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : fails,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    await audit(lock ? "auth.account_locked" : "auth.login_failed", {
      actorUserId: user.id,
      metadata: { reason: "bad_password", fails, emailKey },
      headers: req.headers,
    });
    throw new HttpError(401, GENERIC);
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const mfaPending = user.mfaEnabled;
  const { token, maxAgeSec } = await createSession(user.id, !mfaPending, req.headers);
  await audit(mfaPending ? "auth.password_ok_mfa_pending" : "auth.login_success", {
    actorUserId: user.id,
    headers: req.headers,
  });

  const next = mfaPending ? "/admin/mfa" : user.mustChangePassword || mfaRequired() ? "/admin/security" : "/admin";
  return json({ ok: true, next }, 200, { "Set-Cookie": sessionCookie(token, maxAgeSec) });
});
