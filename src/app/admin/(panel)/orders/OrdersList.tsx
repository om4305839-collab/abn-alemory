"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Modal } from "@/components/admin/ui";
import { apiRequest } from "@/lib/client-api";
import {
  allowedNextStatuses,
  DECISION_LABELS,
  formatDateTime,
  formatMoney,
  STATUS_LABELS,
  STATUS_STYLES,
  type OrderStatusValue,
} from "@/lib/labels";

export type OrderView = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string;
  location: { lat: string; lng: string; accuracy: number | null } | null;
  status: OrderStatusValue;
  decision: "pending" | "accepted" | "rejected";
  rejectionReason: string;
  paymentMethodName: string;
  subtotalCents: number;
  depositPercent: number;
  depositCents: number;
  remainingCents: number;
  createdAt: string;
  hasReceipt: boolean;
  items: { id: string; name: string; qty: number; unitCents: number; totalCents: number }[];
};

export function OrdersList({
  orders,
  canUpdate,
  canReadReceipts,
}: {
  orders: OrderView[];
  canUpdate: boolean;
  canReadReceipts: boolean;
}) {
  if (orders.length === 0) return <p className="card p-12 text-center text-mocha">لا توجد طلبات مطابقة.</p>;
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} canUpdate={canUpdate} canReadReceipts={canReadReceipts} />
      ))}
    </div>
  );
}

function OrderCard({ order: o, canUpdate, canReadReceipts }: { order: OrderView; canUpdate: boolean; canReadReceipts: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState<{ url: string; mime: string } | null>(null);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const r = await apiRequest(`/api/admin/orders/${o.id}`, { method: "PATCH", json: body });
    setBusy(false);
    if (r.ok) {
      setRejecting(false);
      router.refresh();
    } else setError(r.error);
  }

  async function viewReceipt() {
    setBusy(true);
    setError("");
    const r = await apiRequest<{ url: string; mime: string }>(`/api/admin/orders/${o.id}/receipt`);
    setBusy(false);
    if (r.ok) setReceipt(r.data);
    else setError(r.error);
  }

  const next = o.decision === "accepted" ? allowedNextStatuses(o.status) : [];

  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 hover:bg-cream/60">
        <span className="font-extrabold text-brown" dir="ltr">{o.orderNumber}</span>
        <span className="font-bold text-espresso">{o.customerName}</span>
        <span className="text-sm text-mocha">{formatDateTime(o.createdAt)}</span>
        <span className="font-extrabold">{formatMoney(o.subtotalCents)}</span>
        {o.decision === "pending" && <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-extrabold text-white">يحتاج مراجعة</span>}
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${STATUS_STYLES[o.status]}`}>{STATUS_LABELS[o.status]}</span>
      </summary>

      <div className="space-y-5 border-t border-sand p-4 sm:p-5">
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <dl className="space-y-2">
            <div><dt className="text-xs text-mocha">اسم العميل</dt><dd className="font-bold">{o.customerName}</dd></div>
            <div><dt className="text-xs text-mocha">الهاتف</dt><dd><a href={`tel:${o.customerPhone}`} dir="ltr" className="font-bold text-brown underline">{o.customerPhone}</a></dd></div>
            <div><dt className="text-xs text-mocha">العنوان</dt><dd className="font-bold whitespace-pre-wrap">{o.address}</dd></div>
            {o.notes && <div><dt className="text-xs text-mocha">ملاحظات</dt><dd className="font-bold whitespace-pre-wrap">{o.notes}</dd></div>}
            <div>
              <dt className="text-xs text-mocha">الموقع الجغرافي</dt>
              <dd className="font-bold">
                {o.location ? (
                  <a href={`https://www.google.com/maps?q=${o.location.lat},${o.location.lng}`} target="_blank" rel="noopener noreferrer" className="text-brown underline" dir="ltr">
                    📍 {o.location.lat}, {o.location.lng}
                  </a>
                ) : (
                  <span className="text-mocha">لم يشارك العميل موقعه</span>
                )}
              </dd>
            </div>
          </dl>
          <dl className="space-y-2 rounded-xl bg-cream p-4">
            <div className="flex justify-between"><dt className="text-mocha">إجمالي الطلب</dt><dd className="font-extrabold">{formatMoney(o.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-mocha">العربون {o.depositPercent.toLocaleString("ar-EG")}٪ ({o.paymentMethodName})</dt><dd className="font-extrabold text-brown">{formatMoney(o.depositCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-mocha">المتبقي عند الاستلام</dt><dd className="font-extrabold">{formatMoney(o.remainingCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-mocha">قرار المراجعة</dt><dd className="font-bold">{DECISION_LABELS[o.decision]}</dd></div>
            {o.rejectionReason && <div><dt className="text-xs text-mocha">سبب الرفض</dt><dd className="font-bold">{o.rejectionReason}</dd></div>}
          </dl>
        </div>

        <ul className="divide-y divide-sand rounded-xl border border-sand text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-4 py-2">
              <span className="font-bold">{i.name} <span className="text-mocha">× {i.qty.toLocaleString("ar-EG")} ({formatMoney(i.unitCents)})</span></span>
              <span className="font-extrabold">{formatMoney(i.totalCents)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          {canReadReceipts && o.hasReceipt && (
            <button className="btn btn-outline btn-sm" onClick={viewReceipt} disabled={busy}>🧾 عرض إيصال العربون</button>
          )}
          {canUpdate && o.decision === "pending" && o.status === "new" && !rejecting && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => act({ action: "accept" })} disabled={busy}>✓ قبول الطلب</button>
              <button className="btn btn-danger btn-sm" onClick={() => setRejecting(true)} disabled={busy}>✕ رفض</button>
            </>
          )}
          {canUpdate && next.map((s) => (
            <button key={s} className={`btn btn-sm ${s === "cancelled" ? "btn-danger" : "btn-secondary"}`} onClick={() => act({ action: "status", status: s })} disabled={busy}>
              {s === "cancelled" ? "إلغاء الطلب" : `تحويل إلى: ${STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>

        {rejecting && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3">
            <input className="input flex-1" placeholder="سبب الرفض (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} aria-label="سبب الرفض" />
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => act({ action: "reject", reason })}>تأكيد الرفض</button>
            <button className="btn btn-outline btn-sm" onClick={() => setRejecting(false)}>تراجع</button>
          </div>
        )}
        {error && <Alert>{error}</Alert>}
      </div>

      {receipt && (
        <Modal title={`إيصال العربون — ${o.orderNumber}`} onClose={() => setReceipt(null)} wide>
          <p className="mb-3 text-xs text-mocha">رابط مؤقت (دقيقة واحدة) وتتم مراقبة كل عملية عرض في سجل التدقيق.</p>
          {receipt.mime.startsWith("image/") ? (
            <img src={receipt.url} alt="إيصال دفع العربون" className="mx-auto max-h-[70vh] rounded-xl border border-sand" />
          ) : null}
          <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4">فتح الملف في تبويب جديد</a>
        </Modal>
      )}
    </details>
  );
}
