"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Toggle } from "@/components/admin/ui";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { apiRequest } from "@/lib/client-api";

type S = {
  brandName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  logoUrl: string;
  heroImageUrl: string;
  phone: string;
  whatsapp: string;
  address: string;
  workingHours: string;
  ordersEnabled: boolean;
  ordersClosedMessage: string;
};

export function SettingsForm({ initial }: { initial: S }) {
  const router = useRouter();
  const [s, setS] = useState<S>(initial);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await apiRequest("/api/admin/settings", { method: "PUT", json: s });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "success", text: "تم حفظ الإعدادات." });
      router.refresh();
    } else setMsg({ kind: "error", text: r.error });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-extrabold text-brown">استقبال الطلبات</h2>
        <Toggle checked={s.ordersEnabled} onChange={(v) => set("ordersEnabled", v)} label={s.ordersEnabled ? "استقبال الطلبات مفتوح" : "استقبال الطلبات متوقف مؤقتاً"} />
        <div>
          <label className="label" htmlFor="cm">رسالة تظهر للعملاء عند إيقاف الاستقبال</label>
          <input id="cm" className="input" value={s.ordersClosedMessage} onChange={(e) => set("ordersClosedMessage", e.target.value)} maxLength={200} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-extrabold text-brown">الهوية والصفحة الرئيسية</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bn">اسم المطعم</label>
            <input id="bn" className="input" value={s.brandName} onChange={(e) => set("brandName", e.target.value)} maxLength={60} required />
          </div>
          <div>
            <label className="label" htmlFor="tg">الوصف المختصر</label>
            <input id="tg" className="input" value={s.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="ht">عنوان الصفحة الرئيسية</label>
            <input id="ht" className="input" value={s.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} maxLength={120} required />
          </div>
          <div>
            <label className="label" htmlFor="hs">نص توضيحي</label>
            <input id="hs" className="input" value={s.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} maxLength={300} />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageUploader label="شعار المطعم" value={s.logoUrl} onChange={(u) => set("logoUrl", u)} />
          <ImageUploader label="صورة الصفحة الرئيسية" value={s.heroImageUrl} onChange={(u) => set("heroImageUrl", u)} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-extrabold text-brown">بيانات التواصل</h2>
        <p className="text-sm text-mocha">لا تظهر أزرار الاتصال وواتساب للعملاء إلا بعد إدخال الأرقام الصحيحة.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ph">رقم الهاتف</label>
            <input id="ph" className="input" dir="ltr" inputMode="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} placeholder="01xxxxxxxxx" />
          </div>
          <div>
            <label className="label" htmlFor="wa">رقم واتساب (بصيغة دولية بدون +)</label>
            <input id="wa" className="input" dir="ltr" inputMode="tel" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} maxLength={40} placeholder="20xxxxxxxxxx" />
          </div>
          <div>
            <label className="label" htmlFor="ad">عنوان المطعم</label>
            <input id="ad" className="input" value={s.address} onChange={(e) => set("address", e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="wh">ساعات العمل</label>
            <input id="wh" className="input" value={s.workingHours} onChange={(e) => set("workingHours", e.target.value)} maxLength={120} />
          </div>
        </div>
      </section>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button className="btn btn-primary px-10 py-3" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ الإعدادات"}</button>
    </form>
  );
}
