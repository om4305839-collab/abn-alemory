import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi, destroyOtherSessions } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { hashPassword, passwordPolicyProblem, verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Change own password (also used for the forced change after temporary credentials).
export const POST = api(async (req) => {
  const auth = await authApi(req, { allowMfaSetup: true });
  await enforceRateLimit(`pw-change:${auth.userId}`, 5, 900);
  const { currentPassword, newPassword } = passwordChangeSchema.parse(await readJson(req, 2048));

  const [u] = await db
    .select({ hash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);
  if (!u || !(await verifyPassword(u.hash, currentPassword))) {
    await audit("auth.password_change_failed", { actorUserId: auth.userId, headers: req.headers });
    throw new HttpError(400, "كلمة المرور الحالية غير صحيحة");
  }
  if (newPassword === currentPassword) throw new HttpError(400, "يجب أن تختلف كلمة المرور الجديدة عن الحالية");
  const problem = passwordPolicyProblem(newPassword, u.email);
  if (problem) throw new HttpError(400, problem);

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, auth.userId));
  await destroyOtherSessions(auth.userId, auth.sessionId);
  await audit("auth.password_changed", { actorUserId: auth.userId, headers: req.headers });
  return json({ ok: true });
});
