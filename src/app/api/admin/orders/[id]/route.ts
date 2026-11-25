import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { allowedNextStatuses } from "@/lib/labels";
import { uuidParam, type IdCtx } from "@/lib/params";
import { orderActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Only authenticated staff can change an order. Transitions are validated server-side and applied
 * with conditional UPDATEs (compare-and-set), so concurrent or forged requests can't skip states.
 */
export const PATCH = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "orders.update" });
  const id = uuidParam((await ctx.params).id);
  const body = orderActionSchema.parse(await readJson(req, 4096));
  const [order] = await db
    .select({ id: orders.id, status: orders.status, decision: orders.decision, orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) throw new HttpError(404, "الطلب غير موجود");

  let updated: { id: string }[] = [];
  const conflict = new HttpError(409, "لا يمكن تنفيذ هذا الإجراء على الطلب في حالته الحالية");

  if (body.action === "accept") {
    updated = await db
      .update(orders)
      .set({ decision: "accepted", status: "preparing", updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, "new"), eq(orders.decision, "pending")))
      .returning({ id: orders.id });
  } else if (body.action === "reject") {
    updated = await db
      .update(orders)
      .set({ decision: "rejected", status: "cancelled", rejectionReason: body.reason, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, "new"), eq(orders.decision, "pending")))
      .returning({ id: orders.id });
  } else {
    if (order.decision !== "accepted" || !allowedNextStatuses(order.status).includes(body.status)) throw conflict;
    updated = await db
      .update(orders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, order.status), eq(orders.decision, "accepted")))
      .returning({ id: orders.id });
  }
  if (!updated.length) throw conflict;

  await audit(`order.${body.action}`, {
    actorUserId: auth.userId,
    entityType: "order",
    entityId: order.orderNumber,
    metadata: { from: order.status, to: body.action === "status" ? body.status : body.action },
    headers: req.headers,
  });
  return json({ ok: true });
});
