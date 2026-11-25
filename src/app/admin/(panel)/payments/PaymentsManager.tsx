"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Modal, Toggle } from "@/components/admin/ui";
import { apiRequest } from "@/lib/client-api";

type Method = {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
};

export function DepositEditor({ initial }: { initial: number[] }) {
  const router = useRouter();
  const [value, setValue] = useState(initial.join(", "));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nums = value
      .split(/[,،\s]+/)
      .filter(Boolean)
      .map((n) => Number(n));
    if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) {
      return setMsg({ kind: "error", text: "أدخل نسباً صحيحة بين 1 و100 مفصولة بفواصل (مثال: 25, 50)." });
    }
    setBusy(true);
    const r = await apiRequest("/api/admin/settings", { method: "PUT", json: { depositPercentages: nums } });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "success", text: "تم حفظ نسب العربون." });
      router.refresh();
    } else setMsg({ kind: "error", text: r.error });
  }

  return (
    <section className="card space-y-4 p-5">
      <h1 className="text-3xl font-extrabold text-brown">نسب العربون</h1>
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <label className="label" htmlFor="dp">النسب المتاحة للعميل (٪) — حتى ٤ نسب</label>
          <input id="dp" className="input" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy}>حفظ</button>
      </form>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </section>
  );
}

const empty: Omit<Method, "id"> = { name: "", accountName: "", accountNumber: "", instructions: "", isActive: true, sortOrder: 0 };

export function PaymentsManager({ methods }: { methods: Method[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<(Omit<Method, "id"> & { id?: string }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    const { id, ...body } = edit;
    const payload = { ...body, sortOrder: Number(body.sortOrder) || 0 };
    const r = id
      ? await apiRequest(`/api/admin/payment-methods/${id}`, { method: "PUT", json: payload })
      : await apiRequest("/api/admin/payment-methods", { method: "POST", json: payload });
    setBusy(false);
    if (r.ok) {
      setEdit(null);
      router.refresh();
    } else setError(r.error);
  }

  async function del(m: Method) {
    if (!confirm(`حذف وسيلة الدفع «${m.name}»؟`)) return;
    const r = await apiRequest(`/api/admin/payment-methods/${m.id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert(r.error);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-extrabold text-brown">وسائل الدفع</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setEdit({ ...empty, sortOrder: methods.length }); }}>+ وسيلة جديدة</button>
      </div>
      <Alert kind="success">تظهر بيانات الحساب للعملاء عند اختيار الوسيلة. أدخل أرقامك الحقيقية فقط؛ كل تعديل يُسجَّل في سجل التدقيق.</Alert>
      <div className="card divide-y divide-sand">
        {methods.length === 0 && <p className="p-8 text-center text-mocha">لا توجد وسائل دفع.</p>}
        {methods.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-extrabold text-espresso">
                {m.name} {!m.isActive && <span className="mr-2 rounded-full bg-stone-200 px-3 py-0.5 text-xs font-bold text-stone-700">متوقفة</span>}
              </p>
              <p className="text-sm text-mocha" dir="auto">
                {m.accountNumber ? `${m.accountName ? m.accountName + " — " : ""}${m.accountNumber}` : "⚠️ لم تُضبط بيانات الحساب بعد"}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => { setError(""); setEdit(m); }}>تعديل</button>
              <button className="btn btn-danger btn-sm" onClick={() => del(m)}>حذف</button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? "تعديل وسيلة دفع" : "وسيلة دفع جديدة"} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label" htmlFor="mn">الاسم (مثال: Vodafone Cash)</label>
              <input id="mn" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={60} required />
            </div>
            <div>
              <label className="label" htmlFor="ma">اسم صاحب الحساب</label>
              <input id="ma" className="input" value={edit.accountName} onChange={(e) => setEdit({ ...edit, accountName: e.target.value })} maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="mu">رقم الحساب / المحفظة / IBAN / عنوان InstaPay</label>
              <input id="mu" className="input" dir="ltr" value={edit.accountNumber} onChange={(e) => setEdit({ ...edit, accountNumber: e.target.value })} maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="mi">تعليمات للعميل</label>
              <textarea id="mi" className="input min-h-20" value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} maxLength={400} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="mo">الترتيب</label>
                <input id="mo" type="number" min={0} max={1000} className="input" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} />
              </div>
              <div className="flex items-end">
                <Toggle checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label="مفعّلة" />
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
