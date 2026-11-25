import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { orderViewToken, safeEqual } from "@/lib/crypto";
import { api, clientIpHash, HttpError, json, readJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { trackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Customers prove ownership with order number + the phone number used on the order.
export const POST = api(async (req) => {
  await enforceRateLimit(`track:${clientIpHash(req.headers)}`, 15, 900, "محاولات كثيرة. حاول لاحقاً.");
  const { orderNumber, phone } = trackSchema.parse(await readJson(req, 2048));
  const [o] = await db
    .select({ orderNumber: orders.orderNumber, phone: orders.customerPhone })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!o || !safeEqual(o.phone, phone)) throw new HttpError(404, "لم يتم العثور على طلب بهذه البيانات");
  return json({ url: `/order/${o.orderNumber}?t=${orderViewToken(o.orderNumber)}` });
});
