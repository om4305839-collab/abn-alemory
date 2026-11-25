import type { Metadata } from "next";
import { getActivePaymentMethods } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { turnstileEnabled } from "@/lib/turnstile";
import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "السلة وإتمام الطلب", robots: { index: false } };

export default async function CartPage() {
  const [settings, paymentMethods] = await Promise.all([getSettings(), getActivePaymentMethods()]);
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-center text-4xl font-extrabold text-brown">السلة وإتمام الطلب</h1>
      <CheckoutClient
        paymentMethods={paymentMethods}
        depositPercentages={settings.depositPercentages}
        ordersEnabled={settings.ordersEnabled}
        closedMessage={settings.ordersClosedMessage}
        turnstileSiteKey={turnstileEnabled() ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") : ""}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
      />
    </div>
  );
}
