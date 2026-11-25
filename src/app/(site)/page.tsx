import Link from "next/link";
import { ContactButtons } from "@/components/site/ContactButtons";
import { ProductCard } from "@/components/site/ProductCard";
import { getMenu } from "@/lib/data";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "١", title: "اختر أصنافك", text: "تصفح المنيو وأضف ما تحب إلى السلة." },
  { n: "٢", title: "أدخل بياناتك", text: "الاسم والهاتف والعنوان، ويمكنك مشاركة موقعك بموافقتك." },
  { n: "٣", title: "ادفع العربون", text: "حوّل نسبة العربون وارفع صورة الإيصال." },
  { n: "٤", title: "تابع طلبك", text: "احصل على رقم الطلب وتابع حالته لحظة بلحظة." },
];

export default async function HomePage() {
  const [settings, menu] = await Promise.all([getSettings(), getMenu()]);
  const featured = menu.products.slice(0, 6);

  return (
    <>
      {menu.hasDemo && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-900">
          نسخة تجريبية: الأصناف والأسعار الظاهرة أمثلة فقط وسيتم استبدالها ببيانات المطعم الحقيقية من لوحة الإدارة.
        </div>
      )}

      <section className="relative isolate overflow-hidden bg-espresso">
        <img src={settings.heroImageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-l from-espresso/95 via-espresso/75 to-espresso/20" />
        <div className="container-page py-20 sm:py-28 lg:py-36">
          <div className="max-w-xl space-y-6 text-cream">
            <span className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-tan ring-1 ring-white/20">
              {settings.tagline}
            </span>
            <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl lg:text-6xl">{settings.heroTitle}</h1>
            <p className="text-lg leading-relaxed text-sand/90">{settings.heroSubtitle}</p>
            {!settings.ordersEnabled && (
              <p className="rounded-xl bg-rose-900/60 px-4 py-3 text-sm font-bold ring-1 ring-rose-300/40">{settings.ordersClosedMessage}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/menu" className="btn bg-cream px-7 py-3 text-base text-espresso hover:bg-white">
                اطلب الآن
              </Link>
              <Link href="/track" className="btn border border-white/40 px-7 py-3 text-base text-cream hover:bg-white/10">
                تتبع طلبك
              </Link>
            </div>
            <ContactButtons phone={settings.phone} whatsapp={settings.whatsapp} />
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-brown">كيف تطلب؟</h2>
          <p className="mt-2 text-mocha">أربع خطوات بسيطة حتى يصلك طلبك</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-6 text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brown text-xl font-extrabold text-cream">{s.n}</span>
              <h3 className="mb-1 text-lg font-extrabold text-espresso">{s.title}</h3>
              <p className="text-sm leading-relaxed text-mocha">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-2xl rounded-2xl bg-sand px-5 py-4 text-center text-sm font-bold text-brown">
          لتأكيد طلبك يُدفع عربون بنسبة {settings.depositPercentages.map((p) => `${p.toLocaleString("ar-EG")}٪`).join(" أو ")} من إجمالي الطلب، ويُسدَّد الباقي عند الاستلام.
        </p>
      </section>

      <section className="container-page pb-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-brown">من أصنافنا</h2>
            <p className="mt-1 text-mocha">اختيارات من المنيو</p>
          </div>
          <Link href="/menu" className="btn btn-secondary">
            كل المنيو ←
          </Link>
        </div>
        {featured.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="card p-10 text-center text-mocha">لم تتم إضافة أصناف بعد. يمكن للإدارة إضافتها من لوحة التحكم.</p>
        )}
      </section>
    </>
  );
}
