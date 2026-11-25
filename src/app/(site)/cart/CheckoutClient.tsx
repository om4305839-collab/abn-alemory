"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PinIcon } from "@/components/Icons";
import { ContactButtons } from "@/components/site/ContactButtons";
import { Turnstile } from "@/components/Turnstile";
import { apiRequest } from "@/lib/client-api";
import { useCart } from "@/lib/cart-store";
import { computeDeposit, formatMoney, MAX_QTY } from "@/lib/labels";

type QuoteLine = { productId: string; name: string; imageUrl: string | null; unitPriceCents: number };
type Quote = { lines: QuoteLine[]; unavailable: string[] };
type PM = { id: string; name: string; accountName: string; accountNumber: string; instructions: string };
type Loc = { lat: number; lng: number; accuracy: number };

const MAX_FILE = 4 * 1024 * 1024;
const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function CheckoutClient(props: {
  paymentMethods: PM[];
  depositPercentages: number[];
  ordersEnabled: boolean;
  closedMessage: string;
  turnstileSiteKey: string;
  phone: string;
  whatsapp: string;
}) {
  const router = useRouter();
  const { items, setQty, remove, clear } = useCart();
  const idsKey = items.map((i) => i.productId).sort().join(",");

  const [quote, setQuote] = useState<{ key: string; data: Quote } | null>(null);
  const [quoteError, setQuoteError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [pmId, setPmId] = useState(props.paymentMethods[0]?.id ?? "");
  const [pct, setPct] = useState(props.depositPercentages[0] ?? 25);
  const [file, setFile] = useState<File | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch authoritative product data (names / prices) from the server whenever the set of products changes.
  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    (async () => {
      const r = await apiRequest<Quote>("/api/cart/quote", {
        json: { items: idsKey.split(",").map((productId) => ({ productId, quantity: 1 })) },
      });
      if (cancelled) return;
      if (r.ok) {
        setQuoteError("");
        setQuote({ key: idsKey, data: r.data });
        r.data.unavailable.forEach((id) => remove(id));
      } else {
        setQuoteError(r.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, remove]);

  const quoteReady = quote?.key === idsKey;
  const lines = items
    .map((it) => {
      const q = quote?.data.lines.find((l) => l.productId === it.productId);
      return q ? { ...q, quantity: it.quantity, lineTotal: q.unitPriceCents * it.quantity } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const { depositCents, remainingCents } = computeDeposit(subtotal, pct);
  const selectedPm = props.paymentMethods.find((p) => p.id === pmId);

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocError("متصفحك لا يدعم تحديد الموقع. اكتب العنوان يدوياً.");
      return;
    }
    setLocBusy(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocBusy(false);
      },
      () => {
        setLocError("تعذر تحديد موقعك (ربما لم تمنح الإذن). يمكنك كتابة العنوان يدوياً.");
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function onFile(f: File | null) {
    setError("");
    if (!f) return setFile(null);
    if (!FILE_TYPES.includes(f.type)) return setError("نوع الملف غير مسموح. ارفع صورة (JPG/PNG/WebP) أو PDF.");
    if (f.size > MAX_FILE) return setError("حجم الملف أكبر من 4 ميجابايت.");
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!lines.length || !quoteReady) return setError("السلة فارغة أو لم يتم تحميل الأسعار بعد.");
    if (name.trim().length < 2) return setError("يرجى إدخال الاسم.");
    if (!/\d{8,}/.test(phone.replace(/[\s\-+()]/g, ""))) return setError("يرجى إدخال رقم هاتف صحيح.");
    if (address.trim().length < 5) return setError("يرجى إدخال العنوان بالتفصيل.");
    if (!pmId) return setError("اختر وسيلة الدفع.");
    if (!file) return setError("يرجى رفع صورة إيصال دفع العربون.");
    if (props.turnstileSiteKey && !captcha) return setError("يرجى إكمال التحقق الأمني.");

    setSubmitting(true);
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        customerName: name,
        customerPhone: phone,
        address,
        notes,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })), // ids + quantities only
        paymentMethodId: pmId,
        depositPercent: pct,
        locationConsent: !!loc,
        location: loc,
        website: honeypot,
        turnstileToken: captcha || undefined,
      }),
    );
    form.set("receipt", file);
    const r = await apiRequest<{ orderNumber: string; token: string }>("/api/orders", { form });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      if (r.status === 409) setQuote(null);
      return;
    }
    clear();
    router.push(`/order/${r.data.orderNumber}?t=${encodeURIComponent(r.data.token)}`);
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-12 text-center">
        <div className="mb-4 text-6xl" aria-hidden="true">🛒</div>
        <h2 className="mb-2 text-2xl font-extrabold text-brown">سلتك فارغة</h2>
        <p className="mb-6 text-mocha">أضف بعض الأصناف من المنيو لتبدأ طلبك.</p>
        <Link href="/menu" className="btn btn-primary">تصفح المنيو</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-6">
        {!props.ordersEnabled && (
          <div className="rounded-2xl bg-rose-50 p-5 text-rose-900 ring-1 ring-rose-200" role="alert">
            <p className="mb-3 font-extrabold">{props.closedMessage}</p>
            <ContactButtons phone={props.phone} whatsapp={props.whatsapp} size="sm" />
          </div>
        )}

        <section className="card p-5 sm:p-6" aria-labelledby="s-cart">
          <h2 id="s-cart" className="mb-4 text-xl font-extrabold text-brown">١. أصناف الطلب</h2>
          {quoteError && <p className="mb-3 text-sm font-bold text-rose-700">{quoteError}</p>}
          {!quoteReady && !quoteError && <p className="py-6 text-center text-mocha">جاري تحميل الأسعار…</p>}
          <ul className="divide-y divide-sand">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 py-3">
                {l.imageUrl ? (
                  <img src={l.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-sand text-2xl" aria-hidden="true">🍲</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-espresso">{l.name}</p>
                  <p className="text-sm text-mocha">{formatMoney(l.unitPriceCents)}</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-sand p-1">
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-white font-bold text-brown" onClick={() => setQty(l.productId, l.quantity - 1)} aria-label={`إنقاص ${l.name}`}>−</button>
                  <span className="min-w-8 text-center text-sm font-extrabold">{l.quantity.toLocaleString("ar-EG")}</span>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-brown font-bold text-cream disabled:opacity-40" disabled={l.quantity >= MAX_QTY} onClick={() => setQty(l.productId, l.quantity + 1)} aria-label={`زيادة ${l.name}`}>+</button>
                </div>
                <p className="w-24 text-left text-sm font-extrabold text-brown">{formatMoney(l.lineTotal)}</p>
                <button type="button" onClick={() => remove(l.productId)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50" aria-label={`حذف ${l.name}`}>✕</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="s-info">
          <h2 id="s-info" className="text-xl font-extrabold text-brown">٢. بيانات العميل</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">الاسم</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
            </div>
            <div>
              <label className="label" htmlFor="phone">رقم الهاتف</label>
              <input id="phone" className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="01xxxxxxxxx" required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address">العنوان بالتفصيل</label>
            <textarea id="address" className="input min-h-24" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" required />
          </div>
          <div className="rounded-xl bg-cream p-4 ring-1 ring-sand">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-outline btn-sm" onClick={locate} disabled={locBusy}>
                <PinIcon className="h-4 w-4" /> {locBusy ? "جاري التحديد…" : loc ? "تحديث موقعي" : "حدّد موقعي (اختياري)"}
              </button>
              {loc && (
                <button type="button" className="text-sm font-bold text-rose-700 underline" onClick={() => setLoc(null)}>
                  إزالة الموقع
                </button>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-mocha">
              لن نحصل على موقعك إلا بعد ضغطك على الزر وموافقتك في نافذة المتصفح، ويُستخدم لتسهيل التوصيل فقط. يمكنك كتابة العنوان يدوياً بدلاً من ذلك.
            </p>
            {loc && <p className="mt-2 text-sm font-bold text-emerald-700" dir="ltr">✓ {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} (±{Math.round(loc.accuracy)}m)</p>}
            {locError && <p className="mt-2 text-sm font-bold text-rose-700">{locError}</p>}
          </div>
          <div>
            <label className="label" htmlFor="notes">ملاحظات (اختياري)</label>
            <input id="notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
          </div>
          {/* honeypot: invisible to humans, bots fill it */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              الموقع الإلكتروني
              <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="s-pay">
          <h2 id="s-pay" className="text-xl font-extrabold text-brown">٣. الدفع والعربون</h2>
          {props.paymentMethods.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">لا توجد وسائل دفع متاحة حالياً. يرجى التواصل مع المطعم.</p>
          ) : (
            <fieldset>
              <legend className="label">وسيلة الدفع</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {props.paymentMethods.map((p) => (
                  <label key={p.id} className={`cursor-pointer rounded-xl border-2 p-3 text-center text-sm font-bold transition ${pmId === p.id ? "border-brown bg-sand text-brown" : "border-sand bg-white text-mocha hover:border-tan"}`}>
                    <input type="radio" name="pm" className="sr-only" checked={pmId === p.id} onChange={() => setPmId(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {selectedPm && (
            <div className="rounded-xl bg-cream p-4 text-sm ring-1 ring-sand">
              {selectedPm.accountNumber ? (
                <>
                  <p className="text-mocha">حوّل العربون إلى:</p>
                  {selectedPm.accountName && <p className="font-bold text-espresso">{selectedPm.accountName}</p>}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-lg font-extrabold tracking-wider text-brown" dir="ltr">{selectedPm.accountNumber}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        void navigator.clipboard?.writeText(selectedPm.accountNumber);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "تم النسخ ✓" : "نسخ"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="font-bold text-amber-800">لم يتم ضبط بيانات هذه الوسيلة بعد. تواصل مع المطعم لمعرفة بيانات التحويل.</p>
              )}
              {selectedPm.instructions && <p className="mt-2 leading-relaxed text-mocha">{selectedPm.instructions}</p>}
            </div>
          )}

          <fieldset>
            <legend className="label">نسبة العربون</legend>
            <div className="grid grid-cols-2 gap-3">
              {props.depositPercentages.map((p) => {
                const d = computeDeposit(subtotal, p);
                return (
                  <label key={p} className={`cursor-pointer rounded-xl border-2 p-4 text-center transition ${pct === p ? "border-brown bg-sand" : "border-sand bg-white hover:border-tan"}`}>
                    <input type="radio" name="pct" className="sr-only" checked={pct === p} onChange={() => setPct(p)} />
                    <span className="block text-2xl font-extrabold text-brown">{p.toLocaleString("ar-EG")}٪</span>
                    <span className="text-sm text-mocha">{formatMoney(d.depositCents)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="receipt">صورة إيصال دفع العربون</label>
            <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input file:ml-3 file:rounded-lg file:border-0 file:bg-brown file:px-4 file:py-1.5 file:text-sm file:font-bold file:text-cream" onChange={(e) => onFile(e.target.files?.[0] ?? null)} required />
            <p className="mt-1 text-xs text-mocha">JPG أو PNG أو WebP أو PDF — بحد أقصى ٤ ميجابايت. الإيصال محفوظ بشكل خاص ولا يراه إلا فريق المطعم.</p>
          </div>
        </section>
      </div>

      <aside className="card sticky top-24 space-y-4 p-5 sm:p-6" aria-label="ملخص الطلب">
        <h2 className="text-xl font-extrabold text-brown">ملخص الطلب</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-mocha">إجمالي الطلب</dt><dd className="font-extrabold text-espresso">{formatMoney(subtotal)}</dd></div>
          <div className="flex justify-between rounded-xl bg-sand px-3 py-2"><dt className="font-bold text-brown">العربون ({pct.toLocaleString("ar-EG")}٪) — يُدفع الآن</dt><dd className="font-extrabold text-brown">{formatMoney(depositCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-mocha">المتبقي عند الاستلام</dt><dd className="font-extrabold text-espresso">{formatMoney(remainingCents)}</dd></div>
        </dl>
        <p className="text-xs leading-relaxed text-mocha">القيم النهائية تُحسب على الخادم من أسعار المنيو الحالية عند إرسال الطلب.</p>
        {props.turnstileSiteKey && <Turnstile siteKey={props.turnstileSiteKey} onToken={setCaptcha} />}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">{error}</p>}
        <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={submitting || !props.ordersEnabled || !quoteReady || props.paymentMethods.length === 0}>
          {submitting ? "جاري إرسال الطلب…" : "إرسال الطلب"}
        </button>
      </aside>
    </form>
  );
}
