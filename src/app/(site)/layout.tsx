import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        تخطي إلى المحتوى
      </a>
      <SiteHeader settings={settings} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
