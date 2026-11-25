"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";

export function TrackForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await apiRequest<{ url: string }>("/api/orders/track", { json: { orderNumber, phone } });
    setBusy(false);
    if (!r.ok) {
      setError(r.status === 400 ? "تحقق من رقم الطلب (مثال: KA-ABCD2345) ورقم الهاتف." : r.error);
      return;
    }
    router.push(r.data.url);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="on">رقم الطلب</label>
        <input id="on" className="input text-center tracking-widest uppercase" dir="ltr" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="KA-XXXXXXXX" maxLength={14} required />
      </div>
      <div>
        <label className="label" htmlFor="ph">رقم الهاتف</label>
        <input id="ph" className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} required />
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? "جاري البحث…" : "عرض حالة الطلب"}</button>
    </form>
  );
}
