import { db } from "@/db";
import { categories } from "@/db/schema";
import { audit } from "@/lib/audit";
import { authApi } from "@/lib/auth";
import { api, json, readJson } from "@/lib/http";
import { categorySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const auth = await authApi(req, { permission: "products.manage" });
  const data = categorySchema.parse(await readJson(req));
  const [row] = await db.insert(categories).values(data).returning({ id: categories.id });
  await audit("category.create", {
    actorUserId: auth.userId,
    entityType: "category",
    entityId: row.id,
    metadata: { name: data.name },
    headers: req.headers,
  });
  return json({ id: row.id }, 201);
});
