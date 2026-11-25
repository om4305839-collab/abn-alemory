import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, paymentMethods, paymentReceipts, products } from "@/db/schema";
import { randomOrderNumber } from "./crypto";
import { HttpError } from "./http";
import { computeDeposit, MAX_QTY } from "./labels";
import type { OrderPayload } from "./validation";
import type { StoredRef } from "./storage";

export type QuoteLine = {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

type Selector = Pick<typeof db, "select">;

/**
 * Authoritative price calculation. Prices ALWAYS come from the database —
 * the browser only tells us which products and how many.
 */
export async function quoteCart(
  items: { productId: string; quantity: number }[],
  executor: Selector = db,
): Promise<{ lines: QuoteLine[]; unavailable: string[]; subtotalCents: number }> {
  const merged = new Map<string, number>();
  for (const it of items) {
    merged.set(it.productId, Math.min(MAX_QTY, (merged.get(it.productId) ?? 0) + it.quantity));
  }
  const ids = Array.from(merged.keys());
  const rows = await executor
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
      imageUrl: products.imageUrl,
      isActive: products.isActive,
    })
    .from(products)
    .where(inArray(products.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines: QuoteLine[] = [];
  const unavailable: string[] = [];
  for (const [id, quantity] of merged) {
    const p = byId.get(id);
    if (!p || !p.isActive) {
      unavailable.push(id);
      continue;
    }
    lines.push({
      productId: id,
      name: p.name,
      imageUrl: p.imageUrl,
      unitPriceCents: p.priceCents,
      quantity,
      lineTotalCents: p.priceCents * quantity,
    });
  }
  return { lines, unavailable, subtotalCents: lines.reduce((s, l) => s + l.lineTotalCents, 0) };
}

export async function createOrder(
  input: OrderPayload,
  allowedDeposits: number[],
  receipt: StoredRef & { mime: string; size: number; sha256: string },
  ipHash: string,
): Promise<{ orderNumber: string }> {
  if (!allowedDeposits.includes(input.depositPercent)) {
    throw new HttpError(400, "نسبة العربون غير متاحة");
  }
  const consent = input.locationConsent && !!input.location;

  return db.transaction(async (tx) => {
    const [pm] = await tx
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, input.paymentMethodId), eq(paymentMethods.isActive, true)))
      .limit(1);
    if (!pm) throw new HttpError(400, "وسيلة الدفع غير متاحة");

    const q = await quoteCart(input.items, tx);
    if (q.unavailable.length) {
      throw new HttpError(409, "بعض الأصناف لم تعد متاحة. يرجى تحديث السلة.", { unavailable: q.unavailable });
    }
    if (q.subtotalCents <= 0) throw new HttpError(400, "لا يمكن إنشاء طلب بقيمة صفر");

    const { depositCents, remainingCents } = computeDeposit(q.subtotalCents, input.depositPercent);

    let created: { id: string; orderNumber: string } | undefined;
    for (let i = 0; i < 6 && !created; i++) {
      [created] = await tx
        .insert(orders)
        .values({
          orderNumber: randomOrderNumber(),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          address: input.address,
          notes: input.notes,
          locationConsent: consent,
          locationLat: consent ? input.location!.lat.toFixed(6) : null,
          locationLng: consent ? input.location!.lng.toFixed(6) : null,
          locationAccuracyM: consent && input.location!.accuracy != null ? Math.round(input.location!.accuracy) : null,
          paymentMethodId: pm.id,
          paymentMethodName: pm.name,
          subtotalCents: q.subtotalCents,
          depositPercent: input.depositPercent,
          depositCents,
          remainingCents,
          ipHash,
        })
        .onConflictDoNothing({ target: orders.orderNumber })
        .returning({ id: orders.id, orderNumber: orders.orderNumber });
    }
    if (!created) throw new Error("could not allocate order number");

    await tx.insert(orderItems).values(
      q.lines.map((l) => ({
        orderId: created!.id,
        productId: l.productId,
        productName: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        lineTotalCents: l.lineTotalCents,
      })),
    );
    await tx.insert(paymentReceipts).values({
      orderId: created.id,
      storageBucket: receipt.bucket,
      storagePath: receipt.path,
      mimeType: receipt.mime,
      sizeBytes: receipt.size,
      sha256: receipt.sha256,
    });
    return { orderNumber: created.orderNumber };
  });
}
