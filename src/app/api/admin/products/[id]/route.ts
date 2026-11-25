import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { uuidParam, type IdCtx } from "@/lib/params";
import { productSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const id = uuidParam((await ctx.params).id);
  const data = productSchema.parse(await readJson(req));
  if (data.categoryId) {
    const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, data.categoryId)).limit(1);
    if (!c) throw new HttpError(400, "التصنيف غير موجود");
  }
  const [before] = await db.select({ priceCents: products.priceCents }).from(products).where(eq(products.id, id)).limit(1);
  if (!before) throw new HttpError(404, "المنتج غير موجود");
  await db
    .update(products)
    .set({ ...data, isDemo: false, updatedAt: new Date() })
    .where(eq(products.id, id));
  await audit("product.update", {
    actorUserId: auth.userId,
    entityType: "product",
    entityId: id,
    metadata: { name: data.name, oldPriceCents: before.priceCents, newPriceCents: data.priceCents },
    headers: req.headers,
  });
  return json({ ok: true });
});

export const DELETE = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const id = uuidParam((await ctx.params).id);
  const deleted = await db.delete(products).where(eq(products.id, id)).returning({ name: products.name });
  if (!deleted.length) throw new HttpError(404, "المنتج غير موجود");
  await audit("product.delete", {
    actorUserId: auth.userId,
    entityType: "product",
    entityId: id,
    metadata: { name: deleted[0].name },
    headers: req.headers,
  });
  return json({ ok: true });
});
