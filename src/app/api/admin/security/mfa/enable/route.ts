import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi, destroyOtherSessions } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { api, HttpError, json, readJson } from "@/lib/http";
import { verifyTotp } from "@/lib/mfa";
import { enforceRateLimit } from "@/lib/rate-limit";
import { mfaCodeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Step 2 of MFA enrollment: proves the authenticator works, then activates MFA.
export const POST = api(async (req) => {
  const auth = await authApi(req, { allowMfaSetup: true });
  if (auth.mfaEnabled) throw new HttpError(409, "المصادقة الثنائية مفعّلة بالفعل");
  await enforceRateLimit(`mfa-enable:${auth.userId}`, 8, 600);

  const { code } = mfaCodeSchema.parse(await readJson(req, 1024));
  const [u] = await db
    .select({ pending: users.mfaPendingSecretEnc })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);
  if (!u?.pending) throw new HttpError(400, "ابدأ إعداد المصادقة الثنائية أولاً");

  const secret = decryptSecret(u.pending);
  const result = verifyTotp(secret, code, 0);
  if (!result.ok) throw new HttpError(400, "رمز التحقق غير صحيح");

  await db
    .update(users)
    .set({
      mfaEnabled: true,
      mfaSecretEnc: u.pending,
      mfaPendingSecretEnc: null,
      mfaLastStep: result.step,
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));
  await destroyOtherSessions(auth.userId, auth.sessionId);
  await audit("auth.mfa_enabled", { actorUserId: auth.userId, headers: req.headers });
  return json({ ok: true });
});
