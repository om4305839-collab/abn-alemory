import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { ContactButtons } from "./ContactButtons";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-20 bg-espresso text-cream">
      <div className="container-page grid gap-8 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={settings.logoUrl} alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
            <span className="text-xl font-extrabold">{settings.brandName}</span>
          </div>
          <p className="text-sm leading-relaxed text-tan">{settings.tagline}</p>
        </div>
        <div className="space-y-2 text-sm text-tan">
          <h2 className="mb-3 text-base font-extrabold text-cream">روابط سريعة</h2>
          <Link className="block hover:text-white" href="/menu">المنيو</Link>
          <Link className="block hover:text-white" href="/cart">السلة وإتمام الطلب</Link>
          <Link className="block hover:text-white" href="/track">تتبع طلبك</Link>
        </div>
        <div className="space-y-3 text-sm text-tan">
          <h2 className="mb-3 text-base font-extrabold text-cream">تواصل معنا</h2>
          {settings.address && <p>📍 {settings.address}</p>}
          {settings.workingHours && <p>🕒 {settings.workingHours}</p>}
          {settings.phone || settings.whatsapp ? (
            <ContactButtons phone={settings.phone} whatsapp={settings.whatsapp} size="sm" />
          ) : (
            <p>سيتم إضافة بيانات التواصل قريباً.</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-tan">
        © {new Date().getFullYear()} {settings.brandName} — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
