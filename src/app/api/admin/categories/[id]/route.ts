import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, HttpError, json, readJson } from "@/lib/http";
import { uuidParam, type IdCtx } from "@/lib/params";
import { categorySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const id = uuidParam((await ctx.params).id);
  const data = categorySchema.parse(await readJson(req));
  const updated = await db
    .update(categories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  if (!updated.length) throw new HttpError(404, "التصنيف غير موجود");
  await audit("category.update", {
    actorUserId: auth.userId,
    entityType: "category",
    entityId: id,
    metadata: { name: data.name },
    headers: req.headers,
  });
  return json({ ok: true });
});

export const DELETE = api<IdCtx>(async (req, ctx) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const id = uuidParam((await ctx.params).id);
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning({ name: categories.name });
  if (!deleted.length) throw new HttpError(404, "التصنيف غير موجود");
  await audit("category.delete", {
    actorUserId: auth.userId,
    entityType: "category",
    entityId: id,
    metadata: { name: deleted[0].name },
    headers: req.headers,
  });
  return json({ ok: true });
});
