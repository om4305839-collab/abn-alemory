import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authApi } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { hasPersistentSecret } from "@/lib/env";
import { api, HttpError, json } from "@/lib/http";
import { buildEnrollment, generateTotpSecret } from "@/lib/mfa";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Step 1 of MFA enrollment: generates a TOTP secret (stored encrypted, not active yet).
export const POST = api(async (req) => {
  const auth = await authApi(req, { allowMfaSetup: true });
  if (auth.mfaEnabled) throw new HttpError(409, "المصادقة الثنائية مفعّلة بالفعل");
  if (!hasPersistentSecret()) throw new HttpError(503, "يجب ضبط APP_SECRET على الخادم قبل تفعيل المصادقة الثنائية");
  await enforceRateLimit(`mfa-setup:${auth.userId}`, 10, 600);

  const secret = generateTotpSecret();
  await db
    .update(users)
    .set({ mfaPendingSecretEnc: encryptSecret(secret) })
    .where(eq(users.id, auth.userId));
  const { qr } = await buildEnrollment(secret, auth.email);
  return json({ secret, qr });
});
