"use client";
import Link from "next/link";
import { CartIcon } from "@/components/Icons";
import { useCart } from "@/lib/cart-store";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="btn btn-primary relative" aria-label={`السلة، ${count} عنصر`}>
      <CartIcon />
      <span className="hidden sm:inline">السلة</span>
      {count > 0 && (
        <span className="absolute -top-2 -left-2 grid h-6 min-w-6 place-items-center rounded-full bg-caramel px-1 text-xs font-extrabold text-white ring-2 ring-cream">
          {count.toLocaleString("ar-EG")}
        </span>
      )}
    </Link>
  );
}
