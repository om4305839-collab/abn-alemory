// Shared (client + server) constants and pure helpers.
export const ORDER_STATUSES = ["new", "preparing", "ready", "delivered", "cancelled"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatusValue, string> = {
  new: "جديد",
  preparing: "قيد التجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const STATUS_STYLES: Record<OrderStatusValue, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  preparing: "bg-sky-100 text-sky-900 ring-sky-300",
  ready: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  delivered: "bg-stone-200 text-stone-800 ring-stone-300",
  cancelled: "bg-rose-100 text-rose-900 ring-rose-300",
};

export const DECISION_LABELS = {
  pending: "بانتظار المراجعة",
  accepted: "مقبول",
  rejected: "مرفوض",
} as const;

export const ROLE_LABELS = { owner: "مالك", manager: "مدير", staff: "موظف" } as const;

/** Allowed transitions once an order has been accepted. */
export function allowedNextStatuses(current: OrderStatusValue): OrderStatusValue[] {
  switch (current) {
    case "preparing":
      return ["ready", "delivered", "cancelled"];
    case "ready":
      return ["delivered", "cancelled"];
    default:
      return [];
  }
}

export const MAX_QTY = 50;

// ── money (integer piastres) ─────────────────────────────────
export function formatMoney(cents: number, label = "ج.م"): string {
  const pounds = cents / 100;
  const text = pounds.toLocaleString("ar-EG", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${text} ${label}`;
}

export function computeDeposit(totalCents: number, percent: number) {
  const depositCents = Math.round((totalCents * percent) / 100);
  return { depositCents, remainingCents: totalCents - depositCents };
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  });
}
