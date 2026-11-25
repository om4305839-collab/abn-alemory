#!/usr/bin/env node
/**
 * Live security test-suite. Runs real HTTP attacks against a RUNNING instance and the real database.
 *
 *   BASE_URL=http://localhost:3100 OWNER_EMAIL=... OWNER_PASSWORD=... STAFF_EMAIL=... STAFF_PASSWORD=... \
 *     node scripts/security-tests.mjs
 *
 * Both accounts must already exist (create them with scripts/create-admin.mjs). Use a TEST database.
 * Never point this at production: it creates orders and triggers rate-limit lockouts.
 */
import "dotenv/config";
import { createHash, createHmac, hkdfSync } from "node:crypto";
import fs from "node:fs";
import pg from "pg";
import sharp from "sharp";
import * as OTPAuth from "otpauth";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ORIGIN = new URL(BASE).origin;
const OWNER = { email: process.env.OWNER_EMAIL, password: process.env.OWNER_PASSWORD };
const STAFF = { email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD };
if (!OWNER.email || !OWNER.password || !STAFF.email || !STAFF.password) {
  console.error("Missing OWNER_/STAFF_ credentials");
  process.exit(2);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

let ipCounter = 1;
const freshIp = () => `10.20.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

async function call(path, { method = "GET", json, form, cookie, headers = {}, origin = ORIGIN, ip = freshIp(), redirect = "manual" } = {}) {
  const h = { "x-real-ip": ip, ...headers };
  if (origin) h.origin = origin;
  if (cookie) h.cookie = cookie;
  let body;
  const hasBody = !["GET", "HEAD"].includes(method);
  if (json !== undefined && hasBody) {
    h["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form && hasBody) body = form;
  const res = await fetch(BASE + path, { method, headers: h, body, redirect });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, text, data };
}

const cookieFrom = (res) => {
  const sc = res.headers.getSetCookie?.() ?? [];
  const raw = sc.find((c) => /ka_session=/.test(c));
  return { raw, pair: raw ? raw.split(";")[0] : null };
};

const totp = (secret, offsetSteps = 0) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" }).generate({
    timestamp: Date.now() + offsetSteps * 30000,
  });

async function png(size = 30) {
  return sharp({ create: { width: size, height: size, channels: 3, background: "#cc9966" } }).png().toBuffer();
}

async function placeOrder({ name = "TEST عميل", phone, items, extra = {}, file, fileName = "receipt.png", fileType = "image/png", ip, pct = 25, pm }) {
  const payload = {
    customerName: name,
    customerPhone: phone,
    address: "شارع الاختبار 1، القاهرة",
    notes: "",
    items,
    paymentMethodId: pm,
    depositPercent: pct,
    locationConsent: false,
    ...extra,
  };
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  const buf = file ?? (await png());
  form.set("receipt", new File([buf], fileName, { type: fileType }));
  return call("/api/orders", { method: "POST", form, ip });
}

async function loginFlow(account) {
  // 1) password
  let r = await call("/api/admin/login", { method: "POST", json: account });
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${r.text}`);
  let { pair, raw } = cookieFrom(r);
  const first = { next: r.data.next, raw, pair };
  if (r.data.next === "/admin/security") {
    // enroll MFA through the API
    const setup = await call("/api/admin/security/mfa/setup", { method: "POST", json: {}, cookie: pair });
    if (setup.status !== 200) throw new Error("mfa setup failed " + setup.text);
    const secret = setup.data.secret;
    const en = await call("/api/admin/security/mfa/enable", { method: "POST", json: { code: totp(secret) }, cookie: pair });
    if (en.status !== 200) throw new Error("mfa enable failed " + en.text);
    return { secret, pair, first, enrolled: true };
  }
  throw new Error("unexpected next " + r.data.next);
}

async function mfaLogin(account, secret, { stepOffset = 1 } = {}) {
  const r = await call("/api/admin/login", { method: "POST", json: account });
  if (r.status !== 200 || r.data.next !== "/admin/mfa") throw new Error("expected mfa step, got " + r.text);
  const pending = cookieFrom(r).pair;
  const m = await call("/api/admin/mfa", { method: "POST", json: { code: totp(secret, stepOffset) }, cookie: pending });
  if (m.status !== 200) throw new Error("mfa failed " + m.text);
  return { pair: cookieFrom(m).pair, raw: cookieFrom(m).raw, pending };
}

const fakeUuid = "00000000-0000-4000-8000-000000000000";

async function main() {
  console.log(`\n=== Security tests against ${BASE} ===\n`);
  const [p1, p2] = await q("select id, price_cents from products where is_active order by sort_order limit 2");
  const [pm] = await q("select id from payment_methods where is_active limit 1");

  // ───────────────────────── 1. Unauthenticated access to admin
  for (const p of ["/admin", "/admin/orders", "/admin/products", "/admin/payments", "/admin/settings", "/admin/audit"]) {
    const r = await call(p);
    check(`Admin page ${p} without login redirects to login`, [302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/admin/login"), `status ${r.status}`);
  }
  const adminApis = [
    ["POST", "/api/admin/products"], ["PUT", `/api/admin/products/${fakeUuid}`], ["DELETE", `/api/admin/products/${fakeUuid}`],
    ["POST", "/api/admin/categories"], ["POST", "/api/admin/payment-methods"], ["PUT", "/api/admin/settings"],
    ["PATCH", `/api/admin/orders/${fakeUuid}`], ["GET", `/api/admin/orders/${fakeUuid}/receipt`], ["POST", "/api/admin/media"],
    ["POST", "/api/admin/security/mfa/setup"],
  ];
  for (const [m, p] of adminApis) {
    const r = await call(p, { method: m, json: {} });
    check(`Admin API ${m} ${p} without session → 401`, r.status === 401, `status ${r.status}`);
  }
  const forged = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: false }, cookie: "ka_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA; __Host-ka_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
  check("Forged session cookie rejected (401)", forged.status === 401, `status ${forged.status}`);
  const s0 = (await q("select value from site_settings where key='ordersEnabled'"))[0];
  check("Forged request did not change settings", !s0 || s0.value?.v === true);

  // ───────────────────────── 2. CSRF / CORS
  const evil = await call("/api/admin/login", { method: "POST", json: { email: "a@b.co", password: "x" }, origin: "https://evil.example" });
  check("CSRF: cross-origin POST rejected (403)", evil.status === 403, `status ${evil.status}`);
  const noOrigin = await call("/api/orders", { method: "POST", json: {}, origin: null });
  check("CSRF: POST without Origin/Fetch-Metadata rejected (403)", noOrigin.status === 403, `status ${noOrigin.status}`);
  const pre = await call("/api/orders", { method: "OPTIONS", origin: "https://evil.example", headers: { "access-control-request-method": "POST" } });
  check("CORS: preflight from foreign origin has no Access-Control-Allow-Origin", !pre.headers.get("access-control-allow-origin"), `status ${pre.status}`);

  // ───────────────────────── 3. Security headers + CSP nonce
  const home = await fetch(BASE + "/");
  const html = await home.text();
  const csp = home.headers.get("content-security-policy") ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  const withoutNonce = scripts.filter((s) => !s.includes(`nonce="${nonce}"`));
  check("CSP present with per-request nonce, frame-ancestors 'none', object-src 'none'", !!nonce && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));
  check("CSP forbids unsafe-inline/unsafe-eval scripts", !/script-src[^;]*'unsafe-(inline|eval)'/.test(csp));
  check(`All ${scripts.length} <script> tags in HTML carry the CSP nonce`, scripts.length > 0 && withoutNonce.length === 0, `missing: ${withoutNonce.length}`);
  const hh = (n) => home.headers.get(n) ?? "";
  check("HSTS header set", /max-age=\d{7,}/.test(hh("strict-transport-security")));
  check("X-Content-Type-Options: nosniff", hh("x-content-type-options") === "nosniff");
  check("Referrer-Policy set", hh("referrer-policy").length > 0);
  check("Permissions-Policy set", hh("permissions-policy").includes("camera=()"));
  check("X-Frame-Options DENY", hh("x-frame-options") === "DENY");
  check("X-Powered-By header removed", !home.headers.get("x-powered-by"));

  // ───────────────────────── 4. Public ordering: price tampering, validation
  const phoneBase = "0109999";
  const okOrder = await placeOrder({
    phone: `${phoneBase}001`, pm: pm.id, pct: 50, ip: freshIp(),
    items: [{ productId: p1.id, quantity: 2, price: 1, priceCents: 1, unitPriceCents: 1 }],
    extra: { subtotalCents: 1, total: 1, totalCents: 1, depositCents: 1, status: "delivered", decision: "accepted", id: fakeUuid },
  });
  check("Order accepted (201) despite tampered price/total/status fields in payload", okOrder.status === 201, `status ${okOrder.status} ${okOrder.status !== 201 ? okOrder.text.slice(0, 120) : ""}`);
  const [dbOrder] = await q("select * from orders where order_number=$1", [okOrder.data?.orderNumber ?? ""]);
  const expectedTotal = p1.price_cents * 2;
  check("Price tampering: stored total equals DB price × qty (not browser value)", dbOrder && dbOrder.subtotal_cents === expectedTotal, `stored ${dbOrder?.subtotal_cents} expected ${expectedTotal}`);
  check("Deposit/remaining computed on server (50%)", dbOrder && dbOrder.deposit_cents === Math.round(expectedTotal * 0.5) && dbOrder.deposit_cents + dbOrder.remaining_cents === expectedTotal);
  check("Status tampering ignored: new/pending", dbOrder && dbOrder.status === "new" && dbOrder.decision === "pending");
  const items = await q("select unit_price_cents from order_items where order_id=$1", [dbOrder?.id]);
  check("Item unit price taken from DB", items[0]?.unit_price_cents === p1.price_cents);

  const bad = [
    ["unlisted deposit percent (99)", { pct: 99, phone: `${phoneBase}002`, items: [{ productId: p1.id, quantity: 1 }] }],
    ["negative quantity", { phone: `${phoneBase}003`, items: [{ productId: p1.id, quantity: -3 }] }],
    ["quantity > 50", { phone: `${phoneBase}004`, items: [{ productId: p1.id, quantity: 9999 }] }],
    ["unknown product id", { phone: `${phoneBase}005`, items: [{ productId: fakeUuid, quantity: 1 }] }],
    ["non-UUID product id", { phone: `${phoneBase}006`, items: [{ productId: "1 OR 1=1", quantity: 1 }] }],
    ["bot honeypot filled", { phone: `${phoneBase}007`, items: [{ productId: p1.id, quantity: 1 }], extra: { website: "http://spam.example" } }],
    ["invalid phone", { phone: "abc", items: [{ productId: p1.id, quantity: 1 }] }],
  ];
  for (const [label, o] of bad) {
    const r = await placeOrder({ pm: pm.id, ...o });
    check(`Order rejected: ${label}`, r.status >= 400 && r.status < 500, `status ${r.status}`);
  }

  // ───────────────────────── 5. Malicious uploads on the public receipt endpoint
  const before = Number((await q("select count(*)::int n from orders"))[0].n);
  const exe = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00"), Buffer.alloc(2000, 65)]);
  const uploads = [
    ["EXE disguised as receipt.png (image/png)", exe, "receipt.png", "image/png"],
    ["EXE named receipt.exe", exe, "receipt.exe", "application/octet-stream"],
    ["HTML file as receipt.html", Buffer.from("<html><script>alert(1)</script></html>"), "receipt.html", "text/html"],
    ["HTML disguised as .jpg (image/jpeg)", Buffer.from("<html><script>alert(1)</script></html>"), "receipt.jpg", "image/jpeg"],
    ["SVG with embedded script", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "receipt.svg", "image/svg+xml"],
    ["SVG disguised as .png", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "receipt.png", "image/png"],
    ["PHP web-shell shell.php.jpg", Buffer.from("<?php system($_GET['c']); ?>"), "shell.php.jpg", "image/jpeg"],
    ["Real PNG bytes but .php extension", await png(), "receipt.php", "image/png"],
    ["Real PNG bytes declared as image/jpeg", await png(), "receipt.png", "image/jpeg"],
    ["PDF with /JavaScript action", Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\n%%EOF"), "receipt.pdf", "application/pdf"],
    ["Truncated/corrupt PNG (valid magic only)", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50, 1)]), "receipt.png", "image/png"],
    ["Oversized file (6 MB PNG-header)", Buffer.concat([await png(), Buffer.alloc(6 * 1024 * 1024)]), "receipt.png", "image/png"],
  ];
  let n = 10;
  for (const [label, buf, name, type] of uploads) {
    const r = await placeOrder({ pm: pm.id, phone: `${phoneBase}1${String(n++).padStart(2, "0")}`, items: [{ productId: p1.id, quantity: 1 }], file: buf, fileName: name, fileType: type });
    check(`Upload blocked: ${label}`, r.status === 400 || r.status === 413, `status ${r.status}`);
  }
  const after = Number((await q("select count(*)::int n from orders"))[0].n);
  check("No order/file stored for any malicious upload", after === before, `orders ${before} → ${after}`);

  // valid files accepted
  const pdfOk = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
  const rPdf = await placeOrder({ pm: pm.id, phone: `${phoneBase}201`, items: [{ productId: p2.id, quantity: 1 }], file: pdfOk, fileName: "receipt.pdf", fileType: "application/pdf" });
  check("Legit PDF receipt accepted", rPdf.status === 201, `status ${rPdf.status}`);

  // ───────────────────────── 6. SQLi + XSS in customer inputs
  const sqli = "Robert'); DROP TABLE orders;-- ' OR '1'='1";
  const xss = `<script>alert(1)</script><img src=x onerror=alert('xss')> "><svg onload=alert(2)>`;
  const rInj = await placeOrder({ name: sqli, phone: `${phoneBase}301`, pm: pm.id, items: [{ productId: p1.id, quantity: 1 }], extra: { address: xss + " شارع", notes: "'; DELETE FROM products; --" } });
  check("SQLi/XSS payloads accepted as plain data (201)", rInj.status === 201, `status ${rInj.status}`);
  const stillThere = await q("select count(*)::int n from orders");
  const prodCount = await q("select count(*)::int n from products");
  check("SQL injection: tables intact after payloads", stillThere[0].n > 0 && prodCount[0].n >= 2);
  const [inj] = await q("select customer_name, address, notes from orders where order_number=$1", [rInj.data?.orderNumber ?? ""]);
  check("SQLi payload stored literally (parameterised queries)", inj?.customer_name?.includes("DROP TABLE orders"));
  check("XSS payload sanitised on input (no angle brackets stored)", inj && !/[<>]/.test(inj.address + inj.customer_name + inj.notes), inj?.address?.slice(0, 60));
  const trackSqli = await call("/api/orders/track", { method: "POST", json: { orderNumber: "KA-' OR '1'='1", phone: "' OR 1=1 --" } });
  check("SQLi on tracking endpoint rejected (400)", trackSqli.status === 400, `status ${trackSqli.status}`);

  // ───────────────────────── 7. Customer cannot read/modify other customers' orders
  const num = okOrder.data.orderNumber;
  const tokenA = okOrder.data.token;
  const numB = rInj.data.orderNumber;
  const r1 = await call(`/order/${num}`);
  check("Order page without token → 404", r1.status === 404, `status ${r1.status}`);
  const r2 = await call(`/order/${num}?t=wrongtoken`);
  check("Order page with wrong token → 404", r2.status === 404);
  const r3 = await call(`/order/${numB}?t=${tokenA}`);
  check("Using order A's token on order B → 404 (no cross-customer access)", r3.status === 404);
  const r4 = await call(`/order/${num}?t=${tokenA}`);
  check("Order page with correct token → 200 and no customer PII", r4.status === 200 && !r4.text.includes("شارع الاختبار") && !r4.text.includes(`${phoneBase}001`), `status ${r4.status}`);
  const t1 = await call("/api/orders/track", { method: "POST", json: { orderNumber: num, phone: "01099990000" } });
  check("Tracking with wrong phone → 404", t1.status === 404, `status ${t1.status}`);
  const t2 = await call("/api/orders/track", { method: "POST", json: { orderNumber: num, phone: `${phoneBase}001` } });
  check("Tracking with right phone → 200", t2.status === 200 && t2.data?.url?.includes(num));
  const mod = await call(`/api/admin/orders/${dbOrder.id}`, { method: "PATCH", json: { action: "status", status: "delivered" } });
  check("Customer (no session) cannot change order status → 401", mod.status === 401);

  // ───────────────────────── 8. Admin login hygiene
  const wrongKnown = await call("/api/admin/login", { method: "POST", json: { email: OWNER.email, password: "Wrong-password-123!" } });
  const wrongUnknown = await call("/api/admin/login", { method: "POST", json: { email: "nobody-here@example.test", password: "Wrong-password-123!" } });
  check("Login errors identical for known/unknown user (no enumeration)", wrongKnown.status === 401 && wrongUnknown.status === 401 && wrongKnown.text === wrongUnknown.text);
  const sqliLogin = await call("/api/admin/login", { method: "POST", json: { email: "admin' OR '1'='1", password: "x' OR '1'='1" } });
  check("SQLi in login rejected (401)", sqliLogin.status === 401);

  // ───────────────────────── 9. Authenticated admin: MFA enforcement, session cookie flags
  const owner = await loginFlow(OWNER);
  const flags = owner.first.raw ?? "";
  check("Session cookie: HttpOnly", /HttpOnly/i.test(flags));
  check("Session cookie: SameSite=Strict", /SameSite=Strict/i.test(flags));
  check("Session cookie: Path=/ and Max-Age set", /Path=\//.test(flags) && /Max-Age=\d+/.test(flags));
  const secureExpected = process.env.EXPECT_SECURE_COOKIE === "true";
  if (secureExpected) check("Session cookie: Secure + __Host- prefix (production mode)", /;\s*Secure/i.test(flags) && flags.startsWith("__Host-ka_session="), flags.split(";")[0].slice(0, 30));
  const raw = owner.first.pair.split("=")[1];
  const sessRows = await q("select id from sessions where id=$1", [raw]);
  check("Session token is stored hashed (raw cookie value is not in DB)", sessRows.length === 0 && (await q("select 1 from sessions where id=$1", [createHash("sha256").update(raw).digest("hex")])).length === 1);

  const o2 = await mfaLogin(OWNER, owner.secret, { stepOffset: 1 });
  check("MFA login: password + TOTP gives full session", !!o2.pair);
  const replay = await call("/api/admin/login", { method: "POST", json: OWNER });
  const replayPending = cookieFrom(replay).pair;
  const apiWhilePending = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: true }, cookie: replayPending });
  check("Password-only (MFA-pending) session cannot call admin API → 401", apiWhilePending.status === 401, `status ${apiWhilePending.status}`);
  const pagePending = await call("/admin/orders", { cookie: replayPending });
  check("MFA-pending session cannot open admin pages (redirect)", [302, 303, 307, 308].includes(pagePending.status));
  const wrongCode = await call("/api/admin/mfa", { method: "POST", json: { code: "000000" }, cookie: replayPending });
  check("Wrong TOTP code rejected (401)", wrongCode.status === 401);
  const replayCode = await call("/api/admin/mfa", { method: "POST", json: { code: totp(owner.secret, 1) }, cookie: replayPending });
  check("TOTP replay (code already used) rejected", replayCode.status === 401, `status ${replayCode.status}`);
  const okCode = await call("/api/admin/mfa", { method: "POST", json: { code: totp(owner.secret, 0) }, cookie: replayPending });
  // step 0 is older than the already-consumed step +1 → must also be rejected (monotonic)
  check("TOTP older than last accepted step rejected", okCode.status === 401, `status ${okCode.status}`);
  const ownerCookie = o2.pair;

  const ordersPage = await call("/admin/orders", { cookie: ownerCookie });
  check("Admin orders page loads for authenticated owner", ordersPage.status === 200);
  check(
    "XSS: stored payloads are not rendered as live HTML in admin (no injected tags/handlers)",
    ordersPage.status === 200 && !ordersPage.text.includes("<img src=x") && !ordersPage.text.includes("<script>alert(1)") && (ordersPage.text.match(/<[^>]*\sonerror=/g) ?? []).length === 0 && (ordersPage.text.match(/<[^>]*\sonload=alert/g) ?? []).length === 0,
  );
  const sqlSearch = await call(`/admin/orders?q=${encodeURIComponent("' OR 1=1 --")}&status=${encodeURIComponent("new' OR '1'='1")}&from=2024-01-01';DROP`, { cookie: ownerCookie });
  check("SQLi in admin search/filter handled safely (200, no results leak)", sqlSearch.status === 200 && !sqlSearch.text.includes(num));
  const pwned = await q("select count(*)::int n from orders");
  check("Orders table still intact after admin SQLi attempt", pwned[0].n > 0);

  // ───────────────────────── 10. Receipts: private + signed + audited
  const rc = await call(`/api/admin/orders/${dbOrder.id}/receipt`, { cookie: ownerCookie });
  check("Admin can obtain short-lived signed receipt URL", rc.status === 200 && rc.data?.url && rc.data?.expiresIn <= 120, `status ${rc.status}`);
  const signed = rc.data?.url ?? "";
  const anon = await call(signed);
  check("Signed receipt URL is useless without an admin session → 401", anon.status === 401, `status ${anon.status}`);
  const withCookie = await call(signed, { cookie: ownerCookie });
  check("Receipt served to admin with nosniff + private/no-store + CSP", withCookie.status === 200 && withCookie.headers.get("x-content-type-options") === "nosniff" && /no-store/.test(withCookie.headers.get("cache-control") ?? "") && (withCookie.headers.get("content-security-policy") ?? "").includes("default-src 'none'"), `status ${withCookie.status}`);
  const tampered = await call(signed.slice(0, -3) + "AAA", { cookie: ownerCookie });
  check("Tampered receipt signature rejected → 403", tampered.status === 403, `status ${tampered.status}`);
  // APP_SECRET comes from the environment, or (when only DATABASE_URL is configured) from the DB fallback
  const appSecret = process.env.APP_SECRET || (await q("select value from site_settings where key='_app_secret'"))[0]?.value?.v;
  const key = Buffer.from(hkdfSync("sha256", appSecret, "ka-salt-v1", "ka:file-url", 32));
  const [rcpt] = await q("select storage_bucket b, storage_path p from payment_receipts where order_id=$1", [dbOrder.id]);
  const mkToken = (e, b = rcpt.b) => {
    const payload = Buffer.from(JSON.stringify({ b, p: rcpt.p, e })).toString("base64url");
    return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
  };
  const expired = await call(`/api/files/${mkToken(Math.floor(Date.now() / 1000) - 5)}`, { cookie: ownerCookie });
  check("Expired (validly signed) receipt URL rejected → 403", expired.status === 403, `status ${expired.status}`);
  const wrongBucket = await call(`/api/files/${mkToken(Math.floor(Date.now() / 1000) + 60, "site-media")}`, { cookie: ownerCookie });
  check("Signed token cannot be pointed at another bucket → 403", wrongBucket.status === 403);
  const trav = await call(`/api/files/${encodeURIComponent("../../etc/passwd")}`, { cookie: ownerCookie });
  check("Path traversal in file token rejected", trav.status === 403 || trav.status === 404);
  const direct = await call(`/api/media/${rcpt.p.split("/").pop()?.split(".")[0] ?? fakeUuid}`);
  check("Receipts are not reachable through the public media endpoint", direct.status === 404);

  // ───────────────────────── 11. Admin API validation / injection
  const badImg = await call("/api/admin/products", { method: "POST", json: { name: "x", priceCents: 100, imageUrl: "javascript:alert(1)" }, cookie: ownerCookie });
  const badImg2 = await call("/api/admin/products", { method: "POST", json: { name: "x", priceCents: 100, imageUrl: "https://evil.example/x.png" }, cookie: ownerCookie });
  check("Product imageUrl javascript:/external URL rejected (400)", badImg.status === 400 && badImg2.status === 400);
  const negPrice = await call("/api/admin/products", { method: "POST", json: { name: "x", priceCents: -5 }, cookie: ownerCookie });
  check("Negative product price rejected (400)", negPrice.status === 400);
  const xssProd = await call("/api/admin/products", { method: "POST", json: { name: "<img src=x onerror=alert(1)>صنف", description: "<script>alert(1)</script>وصف", priceCents: 1234 }, cookie: ownerCookie });
  const [xp] = await q("select name, description from products where id=$1", [xssProd.data?.id ?? fakeUuid]);
  check("HTML in product name/description stripped on save", xssProd.status === 201 && xp && !/[<>]/.test(xp.name + xp.description), xp?.name);
  if (xssProd.data?.id) await call(`/api/admin/products/${xssProd.data.id}`, { method: "DELETE", cookie: ownerCookie });
  const badSettings = await call("/api/admin/settings", { method: "PUT", json: { depositPercentages: [0, 250] }, cookie: ownerCookie });
  const badWa = await call("/api/admin/settings", { method: "PUT", json: { whatsapp: "javascript:alert(1)" }, cookie: ownerCookie });
  check("Invalid settings (deposit %, whatsapp) rejected (400)", badSettings.status === 400 && badWa.status === 400);
  const badId = await call("/api/admin/products/1;DROP-TABLE", { method: "DELETE", cookie: ownerCookie });
  check("Non-UUID id in admin route → 404 (never reaches SQL)", badId.status === 404);
  const trans = await call(`/api/admin/orders/${dbOrder.id}`, { method: "PATCH", json: { action: "status", status: "delivered" }, cookie: ownerCookie });
  check("Illegal state jump (new → delivered without acceptance) rejected → 409", trans.status === 409, `status ${trans.status}`);
  const acc = await call(`/api/admin/orders/${dbOrder.id}`, { method: "PATCH", json: { action: "accept" }, cookie: ownerCookie });
  const acc2 = await call(`/api/admin/orders/${dbOrder.id}`, { method: "PATCH", json: { action: "accept" }, cookie: ownerCookie });
  check("Order accept works once; second accept rejected (409)", acc.status === 200 && acc2.status === 409);
  const progress = await call(`/api/admin/orders/${dbOrder.id}`, { method: "PATCH", json: { action: "status", status: "ready" }, cookie: ownerCookie });
  check("Accepted order can move to 'ready'", progress.status === 200);

  // admin media upload
  const mExe = new FormData();
  mExe.set("file", new File([exe], "logo.png", { type: "image/png" }));
  const mediaExe = await call("/api/admin/media", { method: "POST", form: mExe, cookie: ownerCookie });
  const mSvg = new FormData();
  mSvg.set("file", new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], "logo.svg", { type: "image/svg+xml" }));
  const mediaSvg = await call("/api/admin/media", { method: "POST", form: mSvg, cookie: ownerCookie });
  check("Admin media upload blocks EXE-as-PNG and SVG", mediaExe.status === 400 && mediaSvg.status === 400, `${mediaExe.status}/${mediaSvg.status}`);
  const mOk = new FormData();
  mOk.set("file", new File([await png(200)], "ok.png", { type: "image/png" }));
  const mediaOk = await call("/api/admin/media", { method: "POST", form: mOk, cookie: ownerCookie });
  const served = mediaOk.data?.url ? await call(mediaOk.data.url) : { status: 0, headers: new Headers() };
  check("Valid image re-encoded to WebP and served with nosniff", mediaOk.status === 201 && served.status === 200 && served.headers.get("content-type") === "image/webp" && served.headers.get("x-content-type-options") === "nosniff", `${mediaOk.status}/${served.status}`);

  // ───────────────────────── 11b. Functional admin flows (must still work under all the protections)
  const cat = await call("/api/admin/categories", { method: "POST", json: { name: "تصنيف اختبار", sortOrder: 99 }, cookie: ownerCookie });
  const prod = await call("/api/admin/products", { method: "POST", json: { name: "صنف اختبار فريد", description: "وصف", priceCents: 1550, categoryId: cat.data?.id, isActive: true }, cookie: ownerCookie });
  check("Admin can create category + product", cat.status === 201 && prod.status === 201, `${cat.status}/${prod.status}`);
  const menuHtml = await call("/menu");
  check("New product appears on public menu with DB price", menuHtml.status === 200 && menuHtml.text.includes("صنف اختبار فريد") && menuHtml.text.includes("تصنيف اختبار"));
  const upd = await call(`/api/admin/products/${prod.data?.id}`, { method: "PUT", json: { name: "صنف اختبار فريد", description: "وصف", priceCents: 2000, categoryId: cat.data?.id, isActive: false }, cookie: ownerCookie });
  const menuHtml2 = await call("/menu");
  check("Admin can edit price / hide product (hidden product leaves the menu)", upd.status === 200 && !menuHtml2.text.includes("صنف اختبار فريد"));
  const quoteHidden = await call("/api/cart/quote", { method: "POST", json: { items: [{ productId: prod.data?.id, quantity: 1 }] } });
  check("Hidden product cannot be ordered (quote marks it unavailable)", quoteHidden.status === 200 && quoteHidden.data.unavailable.length === 1 && quoteHidden.data.lines.length === 0);
  const quoteOk = await call("/api/cart/quote", { method: "POST", json: { items: [{ productId: p1.id, quantity: 3, price: 1 }] } });
  check("Cart quote prices come from DB", quoteOk.status === 200 && quoteOk.data.subtotalCents === p1.price_cents * 3);
  const delP = await call(`/api/admin/products/${prod.data?.id}`, { method: "DELETE", cookie: ownerCookie });
  const delC = await call(`/api/admin/categories/${cat.data?.id}`, { method: "DELETE", cookie: ownerCookie });
  check("Admin can delete product + category", delP.status === 200 && delC.status === 200);
  const pmNew = await call("/api/admin/payment-methods", { method: "POST", json: { name: "طريقة اختبار", accountNumber: "01000000000", accountName: "اختبار" }, cookie: ownerCookie });
  const pmUpd = await call(`/api/admin/payment-methods/${pmNew.data?.id}`, { method: "PUT", json: { name: "طريقة اختبار", accountNumber: "01000000001", isActive: false }, cookie: ownerCookie });
  const pmDel = await call(`/api/admin/payment-methods/${pmNew.data?.id}`, { method: "DELETE", cookie: ownerCookie });
  check("Owner can create / edit / delete payment methods", pmNew.status === 201 && pmUpd.status === 200 && pmDel.status === 200);
  const depOk = await call("/api/admin/settings", { method: "PUT", json: { depositPercentages: [50, 25, 25] }, cookie: ownerCookie });
  const [depRow] = await q("select value from site_settings where key='depositPercentages'");
  check("Deposit percentages saved normalised (unique, sorted)", depOk.status === 200 && JSON.stringify(depRow?.value?.v) === "[25,50]");
  const closeOrders = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: false }, cookie: ownerCookie });
  const closedTry = await placeOrder({ pm: pm.id, phone: `${phoneBase}401`, items: [{ productId: p1.id, quantity: 1 }] });
  check("Pausing orders blocks new orders server-side (503)", closeOrders.status === 200 && closedTry.status === 503, `status ${closedTry.status}`);
  const closedCart = await call("/cart");
  check("Cart page shows the 'orders paused' message", closedCart.status === 200 && closedCart.text.includes("استقبال الطلبات متوقف"));
  await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: true, phone: "01012345678", whatsapp: "+20 101 234 5678" }, cookie: ownerCookie });
  const homeContact = await call("/");
  check("Phone/WhatsApp buttons appear only after valid contact data is configured", homeContact.text.includes("tel:01012345678") && homeContact.text.includes("wa.me/201012345678"));
  await call("/api/admin/settings", { method: "PUT", json: { phone: "", whatsapp: "" }, cookie: ownerCookie });
  const homeNoContact = await call("/");
  check("No call/WhatsApp buttons while contact data is empty", !homeNoContact.text.includes("tel:") && !homeNoContact.text.includes("wa.me"));
  for (const p of ["/", "/menu", "/cart", "/track", "/admin/login"]) {
    const r = await call(p);
    check(`Public page ${p} renders (200)`, r.status === 200, `status ${r.status}`);
  }
  const adminHtml = await Promise.all(["/admin", "/admin/orders", "/admin/products", "/admin/payments", "/admin/settings", "/admin/audit"].map((p) => call(p, { cookie: ownerCookie })));
  check("All admin pages render (200) for owner", adminHtml.every((r) => r.status === 200), adminHtml.map((r) => r.status).join(","));

  // ───────────────────────── 12. RBAC (staff)
  const staff = await loginFlow(STAFF);
  const st2 = await mfaLogin(STAFF, staff.secret, { stepOffset: 1 });
  const staffCookie = st2.pair;
  const sSettings = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: true }, cookie: staffCookie });
  const sPay = await call("/api/admin/payment-methods", { method: "POST", json: { name: "Evil", accountNumber: "0100000000" }, cookie: staffCookie });
  const sProd = await call("/api/admin/products", { method: "POST", json: { name: "x", priceCents: 1 }, cookie: staffCookie });
  check("RBAC: staff cannot change settings / payment methods / products (403)", sSettings.status === 403 && sPay.status === 403 && sProd.status === 403, `${sSettings.status}/${sPay.status}/${sProd.status}`);
  const sPage = await call("/admin/payments", { cookie: staffCookie });
  check("RBAC: staff redirected away from /admin/payments", [302, 303, 307, 308].includes(sPage.status) && !(sPage.headers.get("location") ?? "").includes("login"), `→ ${sPage.headers.get("location")}`);
  const sAudit = await call("/admin/audit", { cookie: staffCookie });
  check("RBAC: staff cannot open audit log", [302, 303, 307, 308].includes(sAudit.status));
  const sOrders = await call("/admin/orders", { cookie: staffCookie });
  check("RBAC: staff can view orders", sOrders.status === 200);
  const logoutStaff = await call("/api/admin/logout", { method: "POST", json: {}, cookie: staffCookie });
  const afterLogout = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: true }, cookie: staffCookie });
  check("Logout invalidates the session server-side", logoutStaff.status === 200 && afterLogout.status === 401);

  // ───────────────────────── 12b. Temporary credentials → forced password change
  if (process.env.CHANGE_EMAIL) {
    const CH = { email: process.env.CHANGE_EMAIL, password: process.env.CHANGE_PASSWORD };
    const NEWPW = `Zq-${Date.now()}-Xv9!kT`;
    const l1 = await call("/api/admin/login", { method: "POST", json: CH });
    const ck = cookieFrom(l1).pair;
    check("Temporary-credential account is sent to /admin/security on first login", l1.status === 200 && l1.data.next === "/admin/security");
    const pg = await call("/admin/orders", { cookie: ck });
    check("must-change account cannot open admin pages (redirected to security)", [302, 303, 307, 308].includes(pg.status) && (pg.headers.get("location") ?? "").includes("/admin/security"), String(pg.headers.get("location")));
    const ap = await call("/api/admin/settings", { method: "PUT", json: { ordersEnabled: true }, cookie: ck });
    check("must-change account cannot call admin APIs (403)", ap.status === 403, `status ${ap.status}`);
    const w1 = await call("/api/admin/security/password", { method: "POST", json: { currentPassword: "wrong-password-xx", newPassword: NEWPW }, cookie: ck });
    const w2 = await call("/api/admin/security/password", { method: "POST", json: { currentPassword: CH.password, newPassword: "short" }, cookie: ck });
    const w3 = await call("/api/admin/security/password", { method: "POST", json: { currentPassword: CH.password, newPassword: CH.password }, cookie: ck });
    const w0 = await call("/api/admin/security/password", { method: "POST", json: { currentPassword: CH.password, newPassword: NEWPW }, cookie: undefined });
    check("Password change rejects wrong current / weak / unchanged password; anonymous → 401", [w1, w2, w3].every((r) => r.status === 400) && w0.status === 401, `${w1.status}/${w2.status}/${w3.status}/${w0.status}`);
    const okPw = await call("/api/admin/security/password", { method: "POST", json: { currentPassword: CH.password, newPassword: NEWPW }, cookie: ck });
    check("Password change succeeds with valid input", okPw.status === 200, `status ${okPw.status}`);
    const oldLogin = await call("/api/admin/login", { method: "POST", json: CH });
    const newLogin = await call("/api/admin/login", { method: "POST", json: { email: CH.email, password: NEWPW } });
    const [flag] = await q("select must_change_password m from users where lower(email)=lower($1)", [CH.email]);
    check("After change: old password rejected, new accepted, must-change flag cleared", oldLogin.status === 401 && newLogin.status === 200 && flag.m === false, `${oldLogin.status}/${newLogin.status}/${flag.m}`);
  }

  // ───────────────────────── 13. Error handling does not leak internals
  const malformed = await call("/api/orders", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, form: undefined });
  const badJson = await call("/api/cart/quote", { method: "POST", headers: { "content-type": "application/json" } });
  const leaks = [malformed, badJson, await call("/api/media/not-a-uuid"), await call("/api/nonexistent")];
  check("Error responses contain no stack traces / file paths", leaks.every((r) => !/\bat\s+\w+.*\(|\/app\/|node_modules|\.ts:\d+|ECONN|pg_|SELECT |INSERT /i.test(r.text)), leaks.map((r) => r.status).join(","));

  // ───────────────────────── 14. Rate limiting & brute force (run last)
  let statuses = [];
  for (let i = 0; i < 14; i++) {
    const r = await call("/api/admin/login", { method: "POST", json: { email: "victim@example.test", password: `guess-${i}-Aa1!` }, ip: "203.0.113.50" });
    statuses.push(r.status);
  }
  check("Brute force from one IP is throttled (429 after ≤10 attempts)", statuses.includes(429) && statuses.indexOf(429) <= 10, statuses.join(" "));
  statuses = [];
  for (let i = 0; i < 12; i++) {
    const r = await call("/api/admin/login", { method: "POST", json: { email: OWNER.email, password: `guess-${i}-Aa1!` } /* rotating IPs */ });
    statuses.push(r.status);
  }
  check("Distributed guessing (rotating IPs) on one account is throttled by per-account limiter", statuses.includes(429), statuses.join(" "));
  const correctAfter = await call("/api/admin/login", { method: "POST", json: OWNER });
  check("Account stays protected: even the correct password is refused while throttled", correctAfter.status === 429 || correctAfter.status === 401, `status ${correctAfter.status}`);
  statuses = [];
  for (let i = 0; i < 14; i++) {
    const r = await call("/api/admin/login", { method: "POST", json: { email: `user${i}@example.test`, password: "Spring2024!" }, ip: "203.0.113.77" });
    statuses.push(r.status);
  }
  check("Credential stuffing (many emails, one IP) is throttled", statuses.includes(429), statuses.join(" "));
  statuses = [];
  for (let i = 0; i < 12; i++) {
    const r = await placeOrder({ pm: pm.id, phone: `0108888${String(i).padStart(3, "0")}`, items: [{ productId: p1.id, quantity: 1 }], file: Buffer.from("junk"), ip: "203.0.113.99" });
    statuses.push(r.status);
  }
  check("Order spam from one IP is throttled (429)", statuses.includes(429), statuses.join(" "));

  // ───────────────────────── 15. Database-level checks
  const [hashRow] = await q("select password_hash, mfa_secret_enc from users where lower(email)=lower($1)", [OWNER.email]);
  check("Password stored as Argon2id hash", hashRow.password_hash.startsWith("$argon2id$"));
  check("MFA secret stored encrypted (AES-GCM), not plaintext", hashRow.mfa_secret_enc.startsWith("v1.") && !hashRow.mfa_secret_enc.includes(owner.secret));
  const rls = await q("select count(*)::int n from pg_class where relkind='r' and relnamespace='public'::regnamespace and not relrowsecurity");
  check("Row Level Security enabled on every public table", rls[0].n === 0, `tables without RLS: ${rls[0].n}`);
  const leak = await q("select count(*)::int n from audit_logs where metadata::text ilike any (array['%'||$1||'%','%'||$2||'%','%guess-%'])", [OWNER.password, STAFF.password]);
  check("Audit log contains no passwords", leak[0].n === 0);
  const actions = await q("select action, count(*)::int n from audit_logs group by 1 order by 1");
  const have = new Set(actions.map((a) => a.action));
  check("Audit trail recorded login failures, lockouts/MFA, orders, receipt views, admin changes", ["auth.login_failed", "auth.login_success", "auth.mfa_enabled", "order.create", "receipt.view", "order.accept", "media.upload"].every((a) => have.has(a)), actions.map((a) => `${a.action}:${a.n}`).join(" "));

  await pool.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  fs.writeFileSync("/tmp/security-results.json", JSON.stringify(results, null, 2));
  if (failed.length) {
    console.log("FAILED:\n" + failed.map((f) => ` - ${f.name} ${f.detail}`).join("\n"));
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Test runner crashed:", e);
  await pool.end().catch(() => {});
  process.exit(2);
});
