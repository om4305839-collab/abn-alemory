import Link from "next/link";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, orders, products } from "@/db/schema";
import { can, requireAdminPage } from "@/lib/auth";
import { formatDateTime, formatMoney, STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { OrdersToggle } from "./OrdersToggle";

export const metadata = { title: "لوحة التحكم" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const auth = await requireAdminPage();
  const { denied } = await searchParams;
  const since = sql`now() - interval '24 hours'`;

  const [settings, [pending], [today], [totalOrders], [activeProducts], recent, failedLogins] = await Promise.all([
    getSettings(),
    db.select({ n: count() }).from(orders).where(eq(orders.decision, "pending")),
    db.select({ n: count() }).from(orders).where(gte(orders.createdAt, since)),
    db.select({ n: count() }).from(orders),
    db.select({ n: count() }).from(products).where(eq(products.isActive, true)),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
    can(auth.role, "audit.read")
      ? db
          .select({ n: count() })
          .from(auditLogs)
          .where(sql`${auditLogs.action} in ('auth.login_failed','auth.account_locked','auth.mfa_failed') and ${auditLogs.createdAt} >= now() - interval '24 hours'`)
      : Promise.resolve([{ n: 0 }]),
  ]);

  const cards = [
    { label: "طلبات بانتظار المراجعة", value: pending.n, tone: "bg-amber-100 text-amber-900" },
    { label: "طلبات آخر ٢٤ ساعة", value: today.n, tone: "bg-sky-100 text-sky-900" },
    { label: "إجمالي الطلبات", value: totalOrders.n, tone: "bg-sand text-brown" },
    { label: "أصناف نشطة", value: activeProducts.n, tone: "bg-emerald-100 text-emerald-900" },
  ];

  return (
    <div className="space-y-8">
      {denied && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">ليست لديك صلاحية للوصول إلى تلك الصفحة.</p>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-brown">مرحباً {auth.displayName || "بك"} 👋</h1>
        {can(auth.role, "settings.manage") && <OrdersToggle enabled={settings.ordersEnabled} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl p-5 ${c.tone}`}>
            <p className="text-3xl font-extrabold">{c.value.toLocaleString("ar-EG")}</p>
            <p className="mt-1 text-sm font-bold">{c.label}</p>
          </div>
        ))}
      </div>

      {can(auth.role, "audit.read") && failedLogins[0].n > 0 && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          ⚠️ تم رصد {failedLogins[0].n.toLocaleString("ar-EG")} محاولة دخول/تحقق فاشلة خلال آخر ٢٤ ساعة. <Link href="/admin/audit?prefix=auth." className="underline">راجع سجل التدقيق</Link>
        </p>
      )}

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-brown">أحدث الطلبات</h2>
          <Link href="/admin/orders" className="btn btn-secondary btn-sm">كل الطلبات</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-mocha">لا توجد طلبات بعد.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {recent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-extrabold text-brown" dir="ltr">{o.orderNumber}</span>
                <span className="font-bold">{o.customerName}</span>
                <span className="text-mocha">{formatDateTime(o.createdAt)}</span>
                <span className="font-extrabold">{formatMoney(o.subtotalCents)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${STATUS_STYLES[o.status]}`}>{STATUS_LABELS[o.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
