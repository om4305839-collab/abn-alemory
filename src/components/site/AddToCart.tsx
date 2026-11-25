"use client";
import { PlusIcon } from "@/components/Icons";
import { useCart } from "@/lib/cart-store";
import { MAX_QTY } from "@/lib/labels";

export function AddToCart({ productId, name }: { productId: string; name: string }) {
  const { items, add, setQty } = useCart();
  const qty = items.find((i) => i.productId === productId)?.quantity ?? 0;

  if (qty === 0) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => add(productId)} aria-label={`أضف ${name} إلى السلة`}>
        <PlusIcon /> أضف للسلة
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-xl bg-sand p-1" role="group" aria-label={`كمية ${name}`}>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg font-bold text-brown hover:bg-tan/50" onClick={() => setQty(productId, qty - 1)} aria-label="إنقاص الكمية">
        −
      </button>
      <span className="min-w-8 text-center text-sm font-extrabold text-espresso" aria-live="polite">
        {qty.toLocaleString("ar-EG")}
      </span>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-brown text-lg font-bold text-cream hover:bg-espresso disabled:opacity-40" disabled={qty >= MAX_QTY} onClick={() => setQty(productId, qty + 1)} aria-label="زيادة الكمية">
        +
      </button>
    </div>
  );
}
