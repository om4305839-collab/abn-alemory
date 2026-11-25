import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, paymentReceipts } from "@/db/schema";
import { can, requireAdminPage } from "@/lib/auth";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/labels";
import { OrdersList, type OrderView } from "./OrdersList";

export const metadata = { title: "الطلبات" };

const PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

type SP = { q?: string; status?: string; from?: string; to?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const auth = await requireAdminPage("orders.read");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const from = sp.from && DATE_RE.test(sp.from) && !Number.isNaN(Date.parse(sp.from)) ? sp.from : "";
  const to = sp.to && DATE_RE.test(sp.to) && !Number.isNaN(Date.parse(sp.to)) ? sp.to : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(sp.page ?? "1", 10) || 1));

  // All filters are parameterised by Drizzle (no string-built SQL).
  const conds: SQL[] = [];
  if (q) {
    const like = `%${escapeLike(q)}%`;
    conds.push(or(ilike(orders.orderNumber, like), ilike(orders.customerName, like), ilike(orders.customerPhone, like))!);
  }
  if (status) conds.push(eq(orders.status, status));
  if (from) conds.push(sql`${orders.createdAt} >= (${from}::date)::timestamp at time zone 'Africa/Cairo'`);
  if (to) conds.push(sql`${orders.createdAt} < ((${to}::date + 1)::timestamp at time zone 'Africa/Cairo')`);
  const where = conds.length ? and(...conds) : undefined;

  const [[total], rows] = await Promise.all([
    db.select({ n: count() }).from(orders).where(where),
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
  ]);
  const ids = rows.map((r) => r.id);
  const [items, receipts] = ids.length
    ? await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
        db.select({ orderId: paymentReceipts.orderId }).from(paymentReceipts).where(inArray(paymentReceipts.orderId, ids)),
      ])
    : [[], []];
  const receiptSet = new Set(receipts.map((r) => r.orderId));

  const views: OrderView[] = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    address: o.address,
    notes: o.notes,
    location: o.locationConsent && o.locationLat && o.locationLng ? { lat: o.locationLat, lng: o.locationLng, accuracy: o.locationAccuracyM } : null,
    status: o.status,
    decision: o.decision,
    rejectionReason: o.rejectionReason,
    paymentMethodName: o.paymentMethodName,
    subtotalCents: o.subtotalCents,
    depositPercent: o.depositPercent,
    depositCents: o.depositCents,
    remainingCents: o.remainingCents,
    createdAt: o.createdAt.toISOString(),
    hasReceipt: receiptSet.has(o.id),
    items: items
      .filter((i) => i.orderId === o.id)
      .map((i) => ({ id: i.id, name: i.productName, qty: i.quantity, unitCents: i.unitPriceCents, totalCents: i.lineTotalCents })),
  }));

  const pages = Math.max(1, Math.ceil(total.n / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    u.set("page", String(p));
    return `/admin/orders?${u.toString()}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-brown">الطلبات <span className="text-lg text-mocha">({total.n.toLocaleString("ar-EG")})</span></h1>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="بحث: رقم الطلب / الاسم / الهاتف" className="input" aria-label="بحث" maxLength={80} />
        <select name="status" defaultValue={status ?? ""} className="input" aria-label="الحالة">
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} className="input" aria-label="من تاريخ" />
        <input type="date" name="to" defaultValue={to} className="input" aria-label="إلى تاريخ" />
        <div className="flex gap-2">
          <button className="btn btn-primary">تصفية</button>
          <Link href="/admin/orders" className="btn btn-outline">مسح</Link>
        </div>
      </form>

      <OrdersList
        orders={views}
        canUpdate={can(auth.role, "orders.update")}
        canReadReceipts={can(auth.role, "receipts.read")}
      />

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="الصفحات">
          {page > 1 && <Link className="btn btn-outline btn-sm" href={qs(page - 1)}>→ السابق</Link>}
          <span className="text-sm font-bold text-mocha">صفحة {page.toLocaleString("ar-EG")} من {pages.toLocaleString("ar-EG")}</span>
          {page < pages && <Link className="btn btn-outline btn-sm" href={qs(page + 1)}>التالي ←</Link>}
        </nav>
      )}
    </div>
  );
}
