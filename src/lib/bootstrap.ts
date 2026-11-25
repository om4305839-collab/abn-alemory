// Runs once per server start (see src/instrumentation.ts). Makes a fresh deployment usable with only
// DATABASE_URL configured. NOTE: no "server-only" import here (instrumentation runs outside RSC).
import { randomBytes } from "node:crypto";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, paymentMethods, products, siteSettings } from "@/db/schema";

const SECRET_KEY = "_app_secret";
const SEEDED_KEY = "_demo_seeded";

async function readSecret(): Promise<string | null> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, SECRET_KEY)).limit(1);
  const v = (row?.value as { v?: unknown } | undefined)?.v;
  return typeof v === "string" && v.length >= 32 ? v : null;
}

/**
 * If APP_SECRET is not provided by the hosting environment, a random 384-bit secret is generated ONCE and
 * persisted in the database so signed links / MFA encryption survive restarts.
 * Trade-off: the key then lives next to the data it protects → for production set APP_SECRET as an
 * environment variable (it always takes priority over the database copy).
 */
export async function ensureAppSecret(): Promise<void> {
  const fromEnv = process.env.APP_SECRET;
  if (fromEnv && fromEnv.length >= 32) return;
  let secret = await readSecret();
  if (!secret) {
    await db
      .insert(siteSettings)
      .values({ key: SECRET_KEY, value: { v: randomBytes(48).toString("base64url") } })
      .onConflictDoNothing(); // concurrent instances end up sharing the first writer's value
    secret = await readSecret();
  }
  if (secret) {
    process.env.APP_SECRET = secret;
    console.warn(
      "[security] APP_SECRET is not set in the environment — using a random secret persisted in the database. Set APP_SECRET for production.",
    );
  }
}

const DEMO_CATEGORIES = [
  { key: "kushari", name: "الكشري" },
  { key: "extras", name: "الإضافات" },
  { key: "sweets", name: "الحلويات" },
  { key: "drinks", name: "المشروبات" },
];

// Placeholder prices for PREVIEW ONLY (flagged is_demo → visible "demo" notice, cleared when edited).
const DEMO_PRODUCTS = [
  { cat: "kushari", name: "كشري صغير (تجريبي)", desc: "مثال تجريبي: أرز وعدس ومكرونة وحمص مع الصلصة والتقلية.", price: 4000, img: "/images/demo/koshary-bowl.jpg" },
  { cat: "kushari", name: "كشري وسط (تجريبي)", desc: "مثال تجريبي: حجم متوسط بنفس المكونات مع صلصة الطماطم الحارة.", price: 6000, img: "/images/demo/koshary-bowl.jpg" },
  { cat: "kushari", name: "كشري سبيشيال (تجريبي)", desc: "مثال تجريبي: حجم كبير مع تقلية إضافية وحمص زيادة.", price: 8500, img: "/images/demo/koshary-special.jpg" },
  { cat: "extras", name: "تقلية إضافية (تجريبي)", desc: "مثال تجريبي: بصل مقرمش.", price: 1500, img: "/images/demo/sides.jpg" },
  { cat: "extras", name: "دقة وشطة (تجريبي)", desc: "مثال تجريبي: صلصة الثوم والخل مع الشطة.", price: 500, img: "/images/demo/sides.jpg" },
  { cat: "sweets", name: "أرز بلبن (تجريبي)", desc: "مثال تجريبي: أرز بلبن بالقرفة.", price: 2500, img: "/images/demo/dessert.jpg" },
  { cat: "drinks", name: "شاي (تجريبي)", desc: "مثال تجريبي: كوب شاي ساخن.", price: 1000, img: "/images/demo/drinks.jpg" },
];

const DEMO_PAYMENTS = ["Vodafone Cash", "InstaPay", "تحويل بنكي"]; // account details intentionally empty

/**
 * Seeds the preview menu exactly ONCE per database (a marker row prevents re-seeding after the owner
 * deletes the demo items). Disable with SEED_DEMO_DATA=false.
 */
export async function ensureDemoData(): Promise<void> {
  if (process.env.SEED_DEMO_DATA === "false") return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727401)`);
    const [marker] = await tx.select().from(siteSettings).where(eq(siteSettings.key, SEEDED_KEY)).limit(1);
    if (marker) return;
    const [{ n: catCount }] = await tx.select({ n: count() }).from(categories);
    const [{ n: prodCount }] = await tx.select({ n: count() }).from(products);
    if (catCount === 0 && prodCount === 0) {
      const ids: Record<string, string> = {};
      let order = 0;
      for (const c of DEMO_CATEGORIES) {
        const [row] = await tx.insert(categories).values({ name: c.name, sortOrder: order++ }).returning({ id: categories.id });
        ids[c.key] = row.id;
      }
      order = 0;
      for (const p of DEMO_PRODUCTS) {
        await tx.insert(products).values({
          categoryId: ids[p.cat],
          name: p.name,
          description: p.desc,
          priceCents: p.price,
          imageUrl: p.img,
          isDemo: true,
          sortOrder: order++,
        });
      }
    }
    const [{ n: pmCount }] = await tx.select({ n: count() }).from(paymentMethods);
    if (pmCount === 0) {
      let order = 0;
      for (const name of DEMO_PAYMENTS) await tx.insert(paymentMethods).values({ name, sortOrder: order++ });
    }
    await tx.insert(siteSettings).values({ key: SEEDED_KEY, value: { v: true } }).onConflictDoNothing();
  });
}
