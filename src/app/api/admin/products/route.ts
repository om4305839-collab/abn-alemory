import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { productSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const data = productSchema.parse(await readJson(req));
  if (data.categoryId) {
    const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, data.categoryId)).limit(1);
    if (!c) throw new HttpError(400, "التصنيف غير موجود");
  }
  const [row] = await db.insert(products).values({ ...data, isDemo: false }).returning({ id: products.id });
  await audit("product.create", {
    actorUserId: auth.userId,
    entityType: "product",
    entityId: row.id,
    metadata: { name: data.name, priceCents: data.priceCents },
    headers: req.headers,
  });
  return json({ id: row.id }, 201);
});
