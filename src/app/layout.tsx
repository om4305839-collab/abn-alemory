import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "كشري ابن العمراوي | اطلب كشري مصري أصيل",
    template: "%s | كشري ابن العمراوي",
  },
  description: "اطلب كشري ابن العمراوي أونلاين: منيو متنوع، دفع عربون بسيط، وتتبع لطلبك.",
  applicationName: "كشري ابن العمراوي",
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = {
  themeColor: "#5b3a22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
