import type { Metadata } from "next";
import { ProductCard } from "@/components/site/ProductCard";
import { getMenu } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المنيو" };

export default async function MenuPage() {
  const { categories, products, hasDemo } = await getMenu();
  const uncategorized = products.filter((p) => !p.categoryId || !categories.some((c) => c.id === p.categoryId));
  const sections = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.categoryId === c.id) })),
    { id: "other", name: "أصناف أخرى", items: uncategorized },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="container-page py-10">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-brown">المنيو</h1>
        <p className="mt-2 text-mocha">اختر ما يعجبك وأضفه إلى السلة</p>
      </div>

      {hasDemo && (
        <p className="mb-8 rounded-2xl bg-amber-100 px-5 py-3 text-center text-sm font-bold text-amber-900">
          نسخة تجريبية: الأصناف والأسعار أمثلة فقط وليست بيانات المطعم الحقيقية.
        </p>
      )}

      {sections.length > 1 && (
        <nav aria-label="التصنيفات" className="sticky top-16 z-30 -mx-4 mb-10 overflow-x-auto bg-cream/95 px-4 py-3 backdrop-blur">
          <ul className="flex w-max gap-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#cat-${s.id}`} className="block rounded-full border border-tan bg-white px-5 py-2 text-sm font-bold whitespace-nowrap text-brown hover:bg-sand">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {sections.length === 0 && <p className="card p-12 text-center text-mocha">لا توجد أصناف متاحة حالياً.</p>}

      <div className="space-y-14">
        {sections.map((s) => (
          <section key={s.id} id={`cat-${s.id}`} aria-labelledby={`h-${s.id}`}>
            <h2 id={`h-${s.id}`} className="mb-6 flex items-center gap-3 text-2xl font-extrabold text-brown">
              <span className="h-7 w-1.5 rounded-full bg-caramel" aria-hidden="true" />
              {s.name}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
