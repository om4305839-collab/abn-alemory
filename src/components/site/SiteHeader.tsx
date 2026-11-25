import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { CartLink } from "./CartLink";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b border-sand bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={settings.brandName}>
          <img src={settings.logoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          <span className="truncate text-lg font-extrabold text-brown">{settings.brandName}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-bold text-brown sm:gap-3" aria-label="التنقل الرئيسي">
          <Link href="/" className="hidden rounded-lg px-3 py-2 hover:bg-sand sm:block">
            الرئيسية
          </Link>
          <Link href="/menu" className="rounded-lg px-3 py-2 hover:bg-sand">
            المنيو
          </Link>
          <Link href="/track" className="rounded-lg px-3 py-2 hover:bg-sand">
            تتبع طلبك
          </Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
