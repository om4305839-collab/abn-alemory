import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { ContactButtons } from "@/components/site/ContactButtons";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { verifyOrderViewToken } from "@/lib/crypto";
import { formatDateTime, formatMoney, STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "حالة الطلب", robots: { index: false, follow: false } };

const FLOW = ["new", "preparing", "ready", "delivered"] as const;

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { number } = await params;
  const { t } = await searchParams;
  // The view token is an HMAC of the order number — without it nobody can open an order page.
  if (!/^KA-[A-Z0-9]{8}$/.test(number) || typeof t !== "string" || t.length > 64 || !verifyOrderViewToken(number, t)) {
    notFound();
  }
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, number)).limit(1);
  if (!order) notFound();
  const [items, settings] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.productName)),
    getSettings(),
  ]);

  const idx = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const cancelled = order.status === "cancelled";

  return (
    <div className="container-page max-w-3xl py-10">
      <AutoRefresh seconds={30} />
      <div className="card space-y-6 p-6 sm:p-8">
        <div className="text-center">
          <p className="text-sm text-mocha">شكراً لطلبك! رقم طلبك</p>
          <p className="my-2 text-4xl font-extrabold tracking-widest text-brown" dir="ltr">{order.orderNumber}</p>
          <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-extrabold ring-1 ${STATUS_STYLES[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <p className="mt-3 text-xs text-mocha">احتفظ بهذا الرقم، ويمكنك تتبع الطلب لاحقاً من صفحة «تتبع طلبك» برقم الطلب ورقم هاتفك.</p>
        </div>

        {order.decision === "pending" && (
          <p className="rounded-xl bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">طلبك قيد المراجعة: سيقوم المطعم بالتأكد من إيصال العربون ثم تأكيد الطلب.</p>
        )}
        {order.decision === "rejected" && (
          <p className="rounded-xl bg-rose-50 p-4 text-center text-sm font-bold text-rose-900">
            نعتذر، تعذر قبول الطلب. {order.rejectionReason && <span>السبب: {order.rejectionReason}</span>}
          </p>
        )}

        {!cancelled && (
          <ol className="grid grid-cols-4 gap-2" aria-label="مراحل الطلب">
            {FLOW.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`mx-auto mb-2 h-2 rounded-full ${i <= idx ? "bg-brown" : "bg-sand"}`} />
                <span className={`text-xs font-bold ${i <= idx ? "text-brown" : "text-mocha/60"}`}>{STATUS_LABELS[s]}</span>
              </li>
            ))}
          </ol>
        )}

        <div>
          <h2 className="mb-3 text-lg font-extrabold text-brown">تفاصيل الطلب</h2>
          <ul className="divide-y divide-sand rounded-xl border border-sand">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-bold text-espresso">{i.productName} <span className="text-mocha">× {i.quantity.toLocaleString("ar-EG")}</span></span>
                <span className="font-extrabold text-brown">{formatMoney(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="space-y-2 rounded-xl bg-cream p-4 text-sm">
          <div className="flex justify-between"><dt className="text-mocha">إجمالي الطلب</dt><dd className="font-extrabold">{formatMoney(order.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-mocha">العربون المدفوع ({order.depositPercent.toLocaleString("ar-EG")}٪) عبر {order.paymentMethodName}</dt><dd className="font-extrabold text-brown">{formatMoney(order.depositCents)}</dd></div>
          <div className="flex justify-between border-t border-sand pt-2"><dt className="font-bold text-brown">المتبقي عند الاستلام</dt><dd className="text-lg font-extrabold text-brown">{formatMoney(order.remainingCents)}</dd></div>
        </dl>
        <p className="text-center text-xs text-mocha">تاريخ الطلب: {formatDateTime(order.createdAt)}</p>

        <div className="flex flex-col items-center gap-4 border-t border-sand pt-6">
          <ContactButtons phone={settings.phone} whatsapp={settings.whatsapp} />
          <Link href="/menu" className="btn btn-secondary">العودة إلى المنيو</Link>
        </div>
      </div>
    </div>
  );
}
