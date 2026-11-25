"use client";
import { useSyncExternalStore } from "react";
import { MAX_QTY } from "./labels";

// Cart lives in localStorage and stores ONLY product ids + quantities.
// Prices are never trusted from the browser: the server re-prices every order.
export type CartItem = { productId: string; quantity: number };

const KEY = "ka_cart_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY: CartItem[] = [];
let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const out: CartItem[] = [];
    for (const it of parsed.slice(0, 40)) {
      if (
        it &&
        typeof it.productId === "string" &&
        UUID.test(it.productId) &&
        Number.isInteger(it.quantity) &&
        it.quantity >= 1 &&
        it.quantity <= MAX_QTY
      ) {
        out.push({ productId: it.productId, quantity: it.quantity });
      }
    }
    return out.length ? out : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(next: CartItem[]) {
  cache = next.length ? next : EMPTY;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full / blocked: keep in-memory state */
  }
  listeners.forEach((l) => l());
}

function getSnapshot(): CartItem[] {
  if (cache === null) cache = read();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const cartActions = {
  add(productId: string, qty = 1) {
    const items = getSnapshot();
    const found = items.find((i) => i.productId === productId);
    if (found) {
      write(items.map((i) => (i === found ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i)));
    } else {
      write([...items, { productId, quantity: Math.min(MAX_QTY, qty) }]);
    }
  },
  setQty(productId: string, qty: number) {
    if (qty <= 0) return cartActions.remove(productId);
    write(getSnapshot().map((i) => (i.productId === productId ? { ...i, quantity: Math.min(MAX_QTY, qty) } : i)));
  },
  remove(productId: string) {
    write(getSnapshot().filter((i) => i.productId !== productId));
  },
  clear() {
    write([]);
  },
};

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, count, ...cartActions };
}
