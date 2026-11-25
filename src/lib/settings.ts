import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export type SiteSettings = {
  brandName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  logoUrl: string;
  heroImageUrl: string;
  phone: string;
  whatsapp: string;
  address: string;
  workingHours: string;
  ordersEnabled: boolean;
  ordersClosedMessage: string;
  depositPercentages: number[];
};

export const SETTINGS_DEFAULTS: SiteSettings = {
  brandName: "كشري ابن العمراوي",
  tagline: "كشري مصري أصيل",
  heroTitle: "طعم الكشري المصري الأصيل",
  heroSubtitle: "اطلب وجبتك المفضلة بسهولة، وأكّد طلبك بعربون بسيط، واستلمها ساخنة.",
  logoUrl: "/images/logo.svg",
  heroImageUrl: "/images/hero.jpg",
  phone: "",
  whatsapp: "",
  address: "",
  workingHours: "",
  ordersEnabled: true,
  ordersClosedMessage: "نعتذر، استقبال الطلبات متوقف مؤقتاً. يرجى المحاولة لاحقاً.",
  depositPercentages: [25, 50],
};

// Values are wrapped as {"v": value}: Drizzle re-parses string jsonb values with JSON.parse, which would
// silently turn strings like "201012345678" or "true" into numbers/booleans.
const wrap = (v: unknown) => ({ v });
const unwrap = (raw: unknown): unknown =>
  raw && typeof raw === "object" && !Array.isArray(raw) && "v" in (raw as object) ? (raw as { v: unknown }).v : raw;

function sameType(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return Array.isArray(b) && b.every((x) => typeof x === "number");
  return typeof a === typeof b;
}

export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings);
  const out: SiteSettings = { ...SETTINGS_DEFAULTS };
  for (const r of rows) {
    const value = unwrap(r.value);
    if (r.key in SETTINGS_DEFAULTS && sameType(SETTINGS_DEFAULTS[r.key as keyof SiteSettings], value)) {
      (out as Record<string, unknown>)[r.key] = value;
    }
  }
  if (!out.depositPercentages.length) out.depositPercentages = SETTINGS_DEFAULTS.depositPercentages;
  return out;
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<string[]> {
  const entries = Object.entries(patch).filter(
    ([k, v]) => k in SETTINGS_DEFAULTS && v !== undefined,
  );
  for (const [key, value] of entries) {
    await db
      .insert(siteSettings)
      .values({ key, value: wrap(value) })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: wrap(value), updatedAt: sql`now()` },
      });
  }
  return entries.map(([k]) => k);
}
