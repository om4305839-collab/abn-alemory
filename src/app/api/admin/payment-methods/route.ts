import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, json, readJson } from "@/lib/http";
import { paymentMethodSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Payment account details are fraud-sensitive: owner-only (`payments.manage`).
export const POST = api(async (req) => {
  const auth = await authApi(req, { permission: "payments.manage" });
  const data = paymentMethodSchema.parse(await readJson(req));
  const [row] = await db.insert(paymentMethods).values(data).returning({ id: paymentMethods.id });
  await audit("payment_method.create", {
    actorUserId: auth.userId,
    entityType: "payment_method",
    entityId: row.id,
    metadata: { name: data.name },
    headers: req.headers,
  });
  return json({ id: row.id }, 201);
});
