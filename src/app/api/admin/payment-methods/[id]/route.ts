import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { uuidParam, type IdCtx } from "@/lib/params";
import { paymentMethodSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "payments.manage" });
  const id = uuidParam((await ctx.params).id);
  const data = paymentMethodSchema.parse(await readJson(req));
  const updated = await db
    .update(paymentMethods)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id))
    .returning({ id: paymentMethods.id });
  if (!updated.length) throw new HttpError(404, "وسيلة الدفع غير موجودة");
  // account number changes are high-risk (payment redirection fraud) → always audited
  await audit("payment_method.update", {
    actorUserId: auth.userId,
    entityType: "payment_method",
    entityId: id,
    metadata: { name: data.name, isActive: data.isActive, accountChanged: true },
    headers: req.headers,
  });
  return json({ ok: true });
});

export const DELETE = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "payments.manage" });
  const id = uuidParam((await ctx.params).id);
  const deleted = await db.delete(paymentMethods).where(eq(paymentMethods.id, id)).returning({ name: paymentMethods.name });
  if (!deleted.length) throw new HttpError(404, "وسيلة الدفع غير موجودة");
  await audit("payment_method.delete", {
    actorUserId: auth.userId,
    entityType: "payment_method",
    entityId: id,
    metadata: { name: deleted[0].name },
    headers: req.headers,
  });
  return json({ ok: true });
});
