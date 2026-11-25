import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getAuthFromHeaders, sessionCookie } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { api, clientIpHash, HttpError, json, readJson } from "@/lib/http";
import { verifyTotp } from "@/lib/mfa";
import { enforceRateLimit } from "@/lib/rate-limit";
import { mfaCodeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Second login step: validates the TOTP code for a password-verified (pending) session.
export const POST = api(async (req) => {
  const auth = await getAuthFromHeaders(req.headers);
  if (!auth || !auth.role) throw new HttpError(401, "انتهت الجلسة. سجّل الدخول مرة أخرى.");
  if (auth.mfaVerified) return json({ ok: true, next: "/admin" });
  if (!auth.mfaEnabled) throw new HttpError(401, "غير مصرح");

  await enforceRateLimit(`mfa:user:${auth.userId}`, 6, 600, "محاولات كثيرة. سجّل الدخول مرة أخرى لاحقاً.");
  await enforceRateLimit(`mfa:ip:${clientIpHash(req.headers)}`, 20, 600);

  const { code } = mfaCodeSchema.parse(await readJson(req, 1024));
  const [u] = await db
    .select({ secret: users.mfaSecretEnc, lastStep: users.mfaLastStep })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);
  if (!u?.secret) throw new HttpError(401, "غير مصرح");

  const result = verifyTotp(decryptSecret(u.secret), code, u.lastStep);
  let accepted = false;
  if (result.ok) {
    // atomic compare-and-set prevents code replay across parallel requests
    const updated = await db
      .update(users)
      .set({ mfaLastStep: result.step })
      .where(and(eq(users.id, auth.userId), lt(users.mfaLastStep, result.step)))
      .returning({ id: users.id });
    accepted = updated.length === 1;
  }
  if (!accepted) {
    await audit("auth.mfa_failed", { actorUserId: auth.userId, headers: req.headers });
    throw new HttpError(401, "رمز التحقق غير صحيح");
  }

  // rotate the session identifier after privilege elevation (prevents fixation)
  await destroySession(auth.sessionId);
  const { token, maxAgeSec } = await createSession(auth.userId, true, req.headers);
  await audit("auth.login_success", { actorUserId: auth.userId, metadata: { mfa: true }, headers: req.headers });
  return json({ ok: true, next: "/admin" }, 200, { "Set-Cookie": sessionCookie(token, maxAgeSec) });
});
