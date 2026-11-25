import { formatMoney } from "@/lib/labels";
import type { MenuProduct } from "@/lib/data";
import { AddToCart } from "./AddToCart";

export function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article className="card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(91,58,34,0.12)]">
      <div className="relative aspect-[4/3] bg-sand">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl" aria-hidden="true">
            🍲
          </div>
        )}
        {product.isDemo && (
          <span className="absolute top-3 right-3 rounded-full bg-espresso/85 px-3 py-1 text-xs font-bold text-cream">تجريبي</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-lg font-extrabold text-espresso">{product.name}</h3>
        {product.description && <p className="line-clamp-3 text-sm leading-relaxed text-mocha">{product.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-lg font-extrabold text-brown">{formatMoney(product.priceCents)}</span>
          <AddToCart productId={product.id} name={product.name} />
        </div>
      </div>
    </article>
  );
}
