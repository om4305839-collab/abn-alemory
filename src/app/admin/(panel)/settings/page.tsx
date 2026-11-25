import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "إعدادات الموقع" };

export default async function SettingsPage() {
  await requireAdminPage("settings.manage");
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-brown">إعدادات الموقع</h1>
      <SettingsForm
        initial={{
          brandName: s.brandName,
          tagline: s.tagline,
          heroTitle: s.heroTitle,
          heroSubtitle: s.heroSubtitle,
          logoUrl: s.logoUrl,
          heroImageUrl: s.heroImageUrl,
          phone: s.phone,
          whatsapp: s.whatsapp,
          address: s.address,
          workingHours: s.workingHours,
          ordersEnabled: s.ordersEnabled,
          ordersClosedMessage: s.ordersClosedMessage,
        }}
      />
    </div>
  );
}
