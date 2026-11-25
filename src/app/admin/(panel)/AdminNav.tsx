"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";

export function AdminNav({
  links,
  email,
  roleLabel,
}: {
  links: { href: string; label: string }[];
  email: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await apiRequest("/api/admin/logout", { method: "POST", json: {} });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-40 border-b border-tan/60 bg-espresso text-cream">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
        <nav className="flex flex-wrap items-center gap-1" aria-label="لوحة الإدارة">
          <img src="/images/logo.svg" alt="" className="ml-2 h-9 w-9 rounded-lg" />
          {links.map((l) => {
            const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${active ? "bg-cream text-espresso" : "text-tan hover:bg-white/10"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-xs">
          <span className="hidden text-tan sm:inline" dir="ltr">{email}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 font-bold">{roleLabel}</span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="font-bold text-tan underline">الموقع</a>
          <button onClick={logout} className="btn btn-sm bg-white/10 text-cream hover:bg-white/20">خروج</button>
        </div>
      </div>
    </header>
  );
}
