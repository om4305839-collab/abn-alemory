#!/usr/bin/env node
/**
 * Demo content so the site can be previewed BEFORE the real menu is entered.
 * Everything inserted here is flagged `is_demo` (products) and shows a visible "demo" notice on the site.
 * Prices are PLACEHOLDERS, not the restaurant's real prices. Payment accounts are left EMPTY.
 * Idempotent: does nothing when categories/products already exist.
 *
 *   node scripts/seed.mjs
 */
import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const categories = [
  { key: "kushari", name: "الكشري", sort: 0 },
  { key: "extras", name: "الإضافات", sort: 1 },
  { key: "sweets", name: "الحلويات", sort: 2 },
  { key: "drinks", name: "المشروبات", sort: 3 },
];

// price_cents are placeholders for preview only
const products = [
  { cat: "kushari", name: "كشري صغير (تجريبي)", desc: "مثال تجريبي: أرز وعدس ومكرونة وحمص مع الصلصة والتقلية.", price: 4000, img: "/images/demo/koshary-bowl.jpg" },
  { cat: "kushari", name: "كشري وسط (تجريبي)", desc: "مثال تجريبي: حجم متوسط بنفس المكونات مع صلصة الطماطم الحارة.", price: 6000, img: "/images/demo/koshary-bowl.jpg" },
  { cat: "kushari", name: "كشري سبيشيال (تجريبي)", desc: "مثال تجريبي: حجم كبير مع تقلية إضافية وحمص زيادة.", price: 8500, img: "/images/demo/koshary-special.jpg" },
  { cat: "extras", name: "تقلية إضافية (تجريبي)", desc: "مثال تجريبي: بصل مقرمش.", price: 1500, img: "/images/demo/sides.jpg" },
  { cat: "extras", name: "دقة وشطة (تجريبي)", desc: "مثال تجريبي: صلصة الثوم والخل مع الشطة.", price: 500, img: "/images/demo/sides.jpg" },
  { cat: "sweets", name: "أرز بلبن (تجريبي)", desc: "مثال تجريبي: أرز بلبن بالقرفة.", price: 2500, img: "/images/demo/dessert.jpg" },
  { cat: "drinks", name: "شاي (تجريبي)", desc: "مثال تجريبي: كوب شاي ساخن.", price: 1000, img: "/images/demo/drinks.jpg" },
];

const payments = [
  { name: "Vodafone Cash", sort: 0 },
  { name: "InstaPay", sort: 1 },
  { name: "تحويل بنكي", sort: 2 },
];

const client = await pool.connect();
try {
  await client.query("begin");
  const { rows: [{ n: catCount }] } = await client.query("select count(*)::int as n from categories");
  const { rows: [{ n: prodCount }] } = await client.query("select count(*)::int as n from products");
  if (catCount === 0 && prodCount === 0) {
    const ids = {};
    for (const c of categories) {
      const r = await client.query("insert into categories (name, sort_order) values ($1,$2) returning id", [c.name, c.sort]);
      ids[c.key] = r.rows[0].id;
    }
    let i = 0;
    for (const p of products) {
      await client.query(
        "insert into products (category_id, name, description, price_cents, image_url, is_demo, sort_order) values ($1,$2,$3,$4,$5,true,$6)",
        [ids[p.cat], p.name, p.desc, p.price, p.img, i++],
      );
    }
    console.log(`✔ Seeded ${categories.length} categories and ${products.length} DEMO products`);
  } else {
    console.log("• Catalogue already has data — skipped");
  }
  const { rows: [{ n: pmCount }] } = await client.query("select count(*)::int as n from payment_methods");
  if (pmCount === 0) {
    for (const p of payments) {
      await client.query("insert into payment_methods (name, sort_order) values ($1,$2)", [p.name, p.sort]);
    }
    console.log("✔ Seeded payment methods (account details intentionally empty — fill them in the admin panel)");
  }
  await client.query("commit");
} catch (e) {
  await client.query("rollback");
  console.error("✖ Seed failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
