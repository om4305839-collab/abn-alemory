# فهرس ملفات المشروع (كل الملفات مفكوكة، لا يوجد ملف مضغوط)

> عدد الملفات: 124 ملفاً (بدون `node_modules` و`.next` لأنهما يُولَّدان تلقائياً بـ `npm ci` و`npm run build`).
> الملفات التي تبدأ بنقطة **مخفية** في أغلب برامج استعراض الملفات: `.gitignore` · `.env.example` · `.github/workflows/ci.yml` (و`.env` للقيم المحلية فقط ولا يُرفع إلى GitHub).

| المسار | الغرض |
|---|---|
| `package.json` / `package-lock.json` | الحزم وسكربتات dev/build/start/lint |
| `next.config.ts` · `tsconfig.json` · `eslint.config.mjs` · `postcss.config.mjs` | إعدادات Next.js وTypeScript وLint وTailwind |
| `drizzle.config.ts` · `drizzle/*.sql` | إعداد Drizzle + ملفات الـ migrations (المخطط الكامل مع RLS) |
| `vercel.json` · `.github/workflows/ci.yml` | إعدادات Vercel وفحص CI (lint/types/build/audit) |
| `.gitignore` · `.env.example` | استبعاد الأسرار من Git + أسماء متغيرات البيئة فقط |
| `README.md` · `SECURITY.md` · `FILES.md` | دليل التشغيل والنشر · تقرير الأمان · هذا الفهرس |
| `src/proxy.ts` · `src/instrumentation.ts` | ترويسات الأمان وCSP وCSRF · تهيئة أول إقلاع |
| `scripts/` | إنشاء الأدمن · بيانات تجريبية · اختبارات الأمان · نسخ احتياطي |
| `supabase/storage-setup.sql` | إنشاء Buckets الإيصالات (خاص) والصور (عام) |

## القائمة الكاملة

### `(الجذر)`
- `.env.example`
- `.gitignore`
- `FILES.md`
- `README.md`
- `SECURITY.md`
- `drizzle.config.ts`
- `eslint.config.mjs`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `tsconfig.json`
- `vercel.json`

### `.github/workflows`
- `ci.yml`

### `drizzle`
- `0000_init.sql`
- `0001_must_change_password.sql`

### `drizzle/meta`
- `0000_snapshot.json`
- `0001_snapshot.json`
- `_journal.json`

### `public/images`
- `hero.jpg`
- `logo.svg`

### `public/images/demo`
- `dessert.jpg`
- `drinks.jpg`
- `koshary-bowl.jpg`
- `koshary-special.jpg`
- `sides.jpg`

### `scripts`
- `backup.sh`
- `create-admin.mjs`
- `security-tests.mjs`
- `seed.mjs`

### `src`
- `instrumentation.ts`
- `proxy.ts`

### `src/app`
- `error.tsx`
- `globals.css`
- `icon.svg`
- `layout.tsx`
- `not-found.tsx`
- `robots.ts`

### `src/app/(site)`
- `layout.tsx`
- `page.tsx`

### `src/app/(site)/cart`
- `CheckoutClient.tsx`
- `page.tsx`

### `src/app/(site)/menu`
- `page.tsx`

### `src/app/(site)/order/[number]`
- `page.tsx`

### `src/app/(site)/track`
- `TrackForm.tsx`
- `page.tsx`

### `src/app/admin`
- `layout.tsx`

### `src/app/admin/(panel)`
- `AdminNav.tsx`
- `OrdersToggle.tsx`
- `layout.tsx`
- `page.tsx`

### `src/app/admin/(panel)/audit`
- `page.tsx`

### `src/app/admin/(panel)/orders`
- `OrdersList.tsx`
- `page.tsx`

### `src/app/admin/(panel)/payments`
- `PaymentsManager.tsx`
- `page.tsx`

### `src/app/admin/(panel)/products`
- `Managers.tsx`
- `page.tsx`

### `src/app/admin/(panel)/settings`
- `SettingsForm.tsx`
- `page.tsx`

### `src/app/admin/login`
- `LoginForm.tsx`
- `page.tsx`

### `src/app/admin/mfa`
- `MfaForm.tsx`
- `page.tsx`

### `src/app/admin/security`
- `SecurityClient.tsx`
- `page.tsx`

### `src/app/api/admin/categories`
- `route.ts`

### `src/app/api/admin/categories/[id]`
- `route.ts`

### `src/app/api/admin/login`
- `route.ts`

### `src/app/api/admin/logout`
- `route.ts`

### `src/app/api/admin/media`
- `route.ts`

### `src/app/api/admin/mfa`
- `route.ts`

### `src/app/api/admin/orders/[id]`
- `route.ts`

### `src/app/api/admin/orders/[id]/receipt`
- `route.ts`

### `src/app/api/admin/payment-methods`
- `route.ts`

### `src/app/api/admin/payment-methods/[id]`
- `route.ts`

### `src/app/api/admin/products`
- `route.ts`

### `src/app/api/admin/products/[id]`
- `route.ts`

### `src/app/api/admin/security/mfa/enable`
- `route.ts`

### `src/app/api/admin/security/mfa/setup`
- `route.ts`

### `src/app/api/admin/security/password`
- `route.ts`

### `src/app/api/admin/settings`
- `route.ts`

### `src/app/api/cart/quote`
- `route.ts`

### `src/app/api/files/[token]`
- `route.ts`

### `src/app/api/health`
- `route.ts`

### `src/app/api/media/[id]`
- `route.ts`

### `src/app/api/orders`
- `route.ts`

### `src/app/api/orders/track`
- `route.ts`

### `src/components`
- `Icons.tsx`
- `Turnstile.tsx`

### `src/components/admin`
- `ImageUploader.tsx`
- `ui.tsx`

### `src/components/site`
- `AddToCart.tsx`
- `AutoRefresh.tsx`
- `CartLink.tsx`
- `ContactButtons.tsx`
- `ProductCard.tsx`
- `SiteFooter.tsx`
- `SiteHeader.tsx`

### `src/db`
- `index.ts`
- `schema.ts`

### `src/lib`
- `audit.ts`
- `auth.ts`
- `bootstrap.ts`
- `cart-store.ts`
- `client-api.ts`
- `crypto.ts`
- `data.ts`
- `env.ts`
- `http.ts`
- `labels.ts`
- `mfa.ts`
- `orders.ts`
- `origin.ts`
- `params.ts`
- `password.ts`
- `rate-limit.ts`
- `settings.ts`
- `storage.ts`
- `turnstile.ts`
- `upload.ts`
- `validation.ts`

### `supabase`
- `storage-setup.sql`
