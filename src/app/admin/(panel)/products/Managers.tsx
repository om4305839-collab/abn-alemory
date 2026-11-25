"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Modal, Toggle } from "@/components/admin/ui";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { apiRequest } from "@/lib/client-api";
import { formatMoney } from "@/lib/labels";

type Cat = { id: string; name: string; sortOrder: number; isActive: boolean };
type Prod = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  categoryId: string | null;
  isActive: boolean;
  isDemo: boolean;
  sortOrder: number;
};

// ───────────────────────── Categories
export function CategoriesManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    const body = { name: edit.name ?? "", sortOrder: Number(edit.sortOrder ?? 0), isActive: edit.isActive ?? true };
    const r = edit.id
      ? await apiRequest(`/api/admin/categories/${edit.id}`, { method: "PUT", json: body })
      : await apiRequest("/api/admin/categories", { method: "POST", json: body });
    setBusy(false);
    if (r.ok) {
      setEdit(null);
      router.refresh();
    } else setError(r.error);
  }

  async function del(c: Cat) {
    if (!confirm(`حذف التصنيف «${c.name}»؟ ستبقى أصنافه بدون تصنيف.`)) return;
    const r = await apiRequest(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert(r.error);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-brown">التصنيفات</h1>
        <button className="btn btn-primary" onClick={() => { setError(""); setEdit({ name: "", sortOrder: categories.length, isActive: true }); }}>+ تصنيف جديد</button>
      </div>
      <div className="card divide-y divide-sand">
        {categories.length === 0 && <p className="p-8 text-center text-mocha">لا توجد تصنيفات.</p>}
        {categories.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-espresso">{c.name}</span>
              {!c.isActive && <span className="rounded-full bg-stone-200 px-3 py-0.5 text-xs font-bold text-stone-700">مخفي</span>}
              <span className="text-xs text-mocha">ترتيب: {c.sortOrder.toLocaleString("ar-EG")}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => { setError(""); setEdit(c); }}>تعديل</button>
              <button className="btn btn-danger btn-sm" onClick={() => del(c)}>حذف</button>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? "تعديل تصنيف" : "تصنيف جديد"} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label" htmlFor="cn">اسم التصنيف</label>
              <input id="cn" className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={80} required />
            </div>
            <div>
              <label className="label" htmlFor="cs">الترتيب</label>
              <input id="cs" type="number" min={0} max={10000} className="input" value={edit.sortOrder ?? 0} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} />
            </div>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="ظاهر في الموقع" />
            {error && <Alert>{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

// ───────────────────────── Products
type Form = {
  id?: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: Form = { name: "", description: "", price: "", categoryId: "", imageUrl: null, isActive: true, sortOrder: 0 };

export function ProductsManager({ products, categories }: { products: Prod[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openEdit(p: Prod) {
    setError("");
    setForm({
      id: p.id,
      name: p.name,
      description: p.description,
      price: (p.priceCents / 100).toString(),
      categoryId: p.categoryId ?? "",
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const price = Number.parseFloat(form.price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return setError("أدخل سعراً صحيحاً.");
    setBusy(true);
    setError("");
    const body = {
      name: form.name,
      description: form.description,
      priceCents: Math.round(price * 100),
      categoryId: form.categoryId || null,
      imageUrl: form.imageUrl,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    const r = form.id
      ? await apiRequest(`/api/admin/products/${form.id}`, { method: "PUT", json: body })
      : await apiRequest("/api/admin/products", { method: "POST", json: body });
    setBusy(false);
    if (r.ok) {
      setForm(null);
      router.refresh();
    } else setError(r.error);
  }

  async function del(p: Prod) {
    if (!confirm(`حذف المنتج «${p.name}» نهائياً؟`)) return;
    const r = await apiRequest(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert(r.error);
  }

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "بدون تصنيف";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-extrabold text-brown">المنتجات</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setForm({ ...emptyForm, sortOrder: products.length }); }}>+ منتج جديد</button>
      </div>
      {products.some((p) => p.isDemo) && (
        <Alert kind="success">الأصناف التي تحمل علامة «تجريبي» أمثلة فقط (أسعارها غير حقيقية). عدّل كل صنف أو احذفه وأضف أصنافك الحقيقية — تختفي العلامة تلقائياً بعد الحفظ.</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <article key={p.id} className={`card overflow-hidden ${p.isActive ? "" : "opacity-60"}`}>
            <div className="relative aspect-[16/9] bg-sand">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-4xl" aria-hidden="true">🍲</div>}
              <div className="absolute top-2 right-2 flex gap-1">
                {p.isDemo && <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white">تجريبي</span>}
                {!p.isActive && <span className="rounded-full bg-stone-700 px-2.5 py-0.5 text-xs font-extrabold text-white">مخفي</span>}
              </div>
            </div>
            <div className="space-y-2 p-4">
              <h3 className="font-extrabold text-espresso">{p.name}</h3>
              <p className="text-xs text-mocha">{catName(p.categoryId)}</p>
              <p className="font-extrabold text-brown">{formatMoney(p.priceCents)}</p>
              <div className="flex gap-2 pt-1">
                <button className="btn btn-outline btn-sm flex-1" onClick={() => openEdit(p)}>تعديل</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(p)}>حذف</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {products.length === 0 && <p className="card p-12 text-center text-mocha">لا توجد منتجات بعد.</p>}

      {form && (
        <Modal title={form.id ? "تعديل منتج" : "منتج جديد"} onClose={() => setForm(null)} wide>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="pn">اسم المنتج</label>
                <input id="pn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="pd">الوصف</label>
                <textarea id="pd" className="input min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={600} />
              </div>
              <div>
                <label className="label" htmlFor="pp">السعر (جنيه)</label>
                <input id="pp" className="input" dir="ltr" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="pc">التصنيف</label>
                <select id="pc" className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">بدون تصنيف</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ps">الترتيب</label>
                <input id="ps" type="number" min={0} max={10000} className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              </div>
              <div className="flex items-end">
                <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="متاح للطلب" />
              </div>
            </div>
            <ImageUploader label="صورة المنتج" value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
            {error && <Alert>{error}</Alert>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ المنتج"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
