import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paymentMethods, products } from "@/db/schema";

export type MenuProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  categoryId: string | null;
  isDemo: boolean;
};
export type MenuCategory = { id: string; name: string };

export async function getMenu(): Promise<{
  categories: MenuCategory[];
  products: MenuProduct[];
  hasDemo: boolean;
}> {
  const [cats, prods] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        priceCents: products.priceCents,
        imageUrl: products.imageUrl,
        categoryId: products.categoryId,
        isDemo: products.isDemo,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.sortOrder), asc(products.name)),
  ]);
  return { categories: cats, products: prods, hasDemo: prods.some((p) => p.isDemo) };
}

export async function getActivePaymentMethods() {
  return db
    .select({
      id: paymentMethods.id,
      name: paymentMethods.name,
      accountName: paymentMethods.accountName,
      accountNumber: paymentMethods.accountNumber,
      instructions: paymentMethods.instructions,
    })
    .from(paymentMethods)
    .where(eq(paymentMethods.isActive, true))
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
}
