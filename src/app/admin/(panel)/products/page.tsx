import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth";
import { CategoriesManager, ProductsManager } from "./Managers";

export const metadata = { title: "المنتجات والتصنيفات" };

export default async function ProductsPage() {
  await requireAdminPage("products.manage");
  const [cats, prods] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(products).orderBy(asc(products.sortOrder), asc(products.name)),
  ]);
  return (
    <div className="space-y-10">
      <CategoriesManager
        categories={cats.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, isActive: c.isActive }))}
      />
      <ProductsManager
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        products={prods.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          categoryId: p.categoryId,
          isActive: p.isActive,
          isDemo: p.isDemo,
          sortOrder: p.sortOrder,
        }))}
      />
    </div>
  );
}
