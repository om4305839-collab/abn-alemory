import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, paymentReceipts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json } from "@/lib/http";
import { uuidParam, type IdCtx } from "@/lib/params";
import { enforceRateLimit } from "@/lib/rate-limit";
import { SIGNED_URL_TTL_SECONDS, signedReceiptUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Returns a SHORT-LIVED signed URL for the (private) deposit receipt. Every access is audited.
export const GET = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "receipts.read" });
  const id = uuidParam((await ctx.params).id);
  await enforceRateLimit(`receipt:${auth.userId}`, 120, 600);
  const [r] = await db
    .select({
      bucket: paymentReceipts.storageBucket,
      path: paymentReceipts.storagePath,
      mime: paymentReceipts.mimeType,
      orderNumber: orders.orderNumber,
    })
    .from(paymentReceipts)
    .innerJoin(orders, eq(orders.id, paymentReceipts.orderId))
    .where(eq(paymentReceipts.orderId, id))
    .limit(1);
  if (!r) throw new HttpError(404, "لا يوجد إيصال لهذا الطلب");
  const url = await signedReceiptUrl({ bucket: r.bucket, path: r.path }, SIGNED_URL_TTL_SECONDS);
  await audit("receipt.view", {
    actorUserId: auth.userId,
    entityType: "order",
    entityId: r.orderNumber,
    headers: req.headers,
  });
  return json({ url, mime: r.mime, expiresIn: SIGNED_URL_TTL_SECONDS });
});
