# كشري ابن العمراوي — موقع طلبات إلكتروني

موقع طلبات متكامل لمطعم كشري مصري: واجهة عملاء عربية RTL، سلة وطلبات بعربون (25٪ / 50٪)، رفع إيصال الدفع، تتبع الطلب، ولوحة إدارة محمية (مصادقة ثنائية، صلاحيات، سجل تدقيق).

> ⚠️ **المشروع مُسلَّم بواجهة تجريبية**: الأصناف والأسعار الظاهرة أمثلة (`is_demo`) وليست بيانات المطعم الحقيقية، وبيانات حسابات الدفع وأرقام الاتصال **فارغة عمداً**. راجع «قائمة الإطلاق» بالأسفل قبل استقبال طلبات حقيقية.

## يعمل بـ `DATABASE_URL` فقط

عند أول إقلاع (`src/instrumentation.ts`) وإذا لم تُضبط بقية المتغيرات:

* **`APP_SECRET` مفقود** ⇒ يُولَّد سر عشوائي (384-bit) **مرة واحدة** ويُحفظ في جدول `site_settings` (المفتاح `_app_secret`) ليبقى ثابتاً بعد إعادة التشغيل. هذا حل احتياطي لتشغيل المعاينة؛ **للإنتاج اضبط `APP_SECRET` في بيئة الاستضافة** (له الأولوية دائماً) لأن بقاء المفتاح بجانب البيانات يُضعف تشفير أسرار MFA عند اختراق القاعدة.
* **المنيو فارغ** ⇒ تُنشأ بيانات تجريبية **مرة واحدة فقط** (علامة `_demo_seeded` تمنع إعادة الإنشاء بعد حذفك لها). عطّلها بـ `SEED_DEMO_DATA=false`.

## التقنيات

| الطبقة | الاختيار |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| تصميم | Tailwind CSS 4 (RTL، خط Cairo، ألوان أبيض/بيج/بني) |
| قاعدة البيانات | PostgreSQL (Supabase أو أي PostgreSQL) عبر Drizzle ORM (استعلامات Parameterized) |
| المصادقة | نظام جلسات خاص: Argon2id + TOTP MFA + جلسات في DB (HttpOnly / Secure / SameSite=Strict) |
| التحقق | Zod على الخادم لكل مُدخل |
| الملفات | Supabase Storage (Bucket خاص للإيصالات + عام للصور) أو تخزين خاص في PostgreSQL للتجربة |
| معالجة الصور | sharp (إعادة ترميز وإزالة EXIF) |

## التشغيل محلياً

المتطلبات: Node.js ≥ 20.9 (يُفضّل 22) وقاعدة PostgreSQL.

```bash
git clone <repo-url> koshary && cd koshary
npm ci

cp .env.example .env
#  عدّل .env:  DATABASE_URL  و  APP_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # لتوليد APP_SECRET

npx drizzle-kit push             # ينشئ الجداول + يفعّل RLS  (أو نفّذ drizzle/0000_init.sql يدوياً)
node scripts/seed.mjs            # (اختياري) بيانات تجريبية للمعاينة
node scripts/create-admin.mjs --email you@example.com --name "اسمك"   # إنشاء حساب الأدمن (انظر الأسفل)

npm run dev                      # http://localhost:3000
```

أوامر الجودة:

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
node scripts/security-tests.mjs   # اختبارات الأمان الحية (على قاعدة اختبار فقط!) — انظر SECURITY.md
```

## إنشاء حساب الأدمن بأمان

لا يوجد تسجيل عام للأدمن إطلاقاً. الحسابات تُنشأ **فقط** من الخادم:

```bash
node scripts/create-admin.mjs --email owner@yourdomain.com --name "المالك" --role owner
```

* كلمة المرور تُدخل تفاعلياً (مخفية) — لا توضع في الكود ولا في Git ولا في تاريخ الـ shell. الحد الأدنى 14 حرفاً وتُرفض الكلمات الشائعة. تُخزَّن بـ **Argon2id**.
* لإنشاء حساب بكلمة مرور **مؤقتة** تُسلَّم لصاحب الموقع أضف `--must-change`: سيُجبَر عند أول دخول على اختيار كلمة مرور جديدة (صفحة `/admin/security`) قبل أي شيء آخر. يمكن تغيير كلمة المرور لاحقاً من نفس الصفحة.
* الأدوار: `owner` (كل شيء) · `manager` (منتجات/إعدادات/طلبات) · `staff` (الطلبات والإيصالات فقط).
* عند أول دخول يُطلب منك **تفعيل المصادقة الثنائية** (Google/Microsoft Authenticator…) — إلزامي افتراضياً (`REQUIRE_ADMIN_MFA=true`).
* نسيت كلمة المرور: `node scripts/create-admin.mjs --email ... --reset-password` (يُلغي كل الجلسات).
* فقدت جهاز المصادقة: `node scripts/create-admin.mjs --email ... --reset-mfa`.

## إعداد قاعدة البيانات والتخزين (Supabase — موصى به)

1. أنشئ مشروعاً في Supabase. انسخ **Connection string** من *Project Settings → Database* (على Vercel استخدم رابط **Transaction pooler** المنفذ 6543 مع `?sslmode=require`) إلى `DATABASE_URL`.
2. أنشئ الجداول: `DATABASE_URL=... npx drizzle-kit push` (أو الصق `drizzle/0000_init.sql` في SQL Editor). كل الجداول تُنشأ مع **RLS مفعّل وبدون Policies** — أي أن واجهة PostgREST العامة (anon/authenticated) لا تقرأ ولا تكتب شيئاً؛ كل الوصول يمر عبر خادم Next.js فقط.
3. أنشئ الـ Buckets: الصق `supabase/storage-setup.sql` في SQL Editor (`receipts` خاص، `site-media` عام للقراءة).
4. من *Project Settings → API* انسخ `Project URL` إلى `SUPABASE_URL` و **service_role key** إلى `SUPABASE_SERVICE_ROLE_KEY`. هذا المفتاح **سري جداً**: يوضع في Vercel Environment Variables فقط، ولا يُكتب في الكود ولا في `NEXT_PUBLIC_*`.
5. فعّل النسخ الاحتياطي اليومي/PITR من *Database → Backups*.

> بدون `SUPABASE_URL` يعمل التطبيق بتخزين خاص داخل PostgreSQL (مناسب للتجربة المحلية). للإنتاج على Vercel استخدم Supabase Storage.

## النشر على GitHub ثم Vercel

```bash
git init -b main
git add -A
git status            # تأكد أن .env غير موجود في القائمة
git commit -m "Initial commit"
git remote add origin git@github.com:<you>/koshary-ibn-elomrawy.git
git push -u origin main
```

1. في Vercel: **Add New → Project →** اختر المستودع (Framework: Next.js يُكتشف تلقائياً، و`vercel.json` جاهز).
2. أضف متغيرات البيئة (Settings → Environment Variables) للبيئة **Production** (و Preview إن لزم) — القائمة بالأسفل.
3. Deploy، ثم اربط الدومين الحقيقي. HTTPS تلقائي، والترويسات الأمنية (HSTS/CSP…) مفعّلة من الكود.
4. بعد أول نشر: نفّذ `drizzle-kit push` و`create-admin.mjs` من جهازك مُشيراً إلى قاعدة الإنتاج (`DATABASE_URL=... node scripts/create-admin.mjs ...`).
5. افحص تاريخ Git قبل النشر: `git log -p | grep -iE "secret|password|service_role|postgres://"` (يجب ألا يظهر شيء).

## متغيرات البيئة

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DATABASE_URL` | ✅ | رابط PostgreSQL (سري) |
| `APP_SECRET` | ✅ | سر عشوائي ≥32 بايت: توقيع الروابط، تشفير أسرار MFA، تجزئة IP (سري — تغييره يُبطل MFA المسجّل وروابط التتبع) |
| `APP_URL` | موصى به | الدومين العام (لقائمة Origin المسموحة) |
| `ALLOWED_ORIGINS` | ❌ | أصول إضافية مسموحة لطلبات الكتابة (مفصولة بفواصل) |
| `REQUIRE_ADMIN_MFA` | ❌ | الافتراضي `true` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | للإنتاج | Supabase Storage (المفتاح سري، خادم فقط) |
| `SUPABASE_RECEIPTS_BUCKET` / `SUPABASE_MEDIA_BUCKET` | ❌ | الافتراضي `receipts` / `site-media` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ❌ | CAPTCHA (Cloudflare Turnstile) للدخول وإرسال الطلب |
| `SEED_DEMO_DATA` | ❌ | `false` لتعطيل البيانات التجريبية التلقائية |
| `INSECURE_COOKIES` | ❌ | `true` للتجربة على HTTP فقط. **اتركه `false`/غير معرَّف في الإنتاج** |

> **المعاينة داخل iframe:** ترويسات منع التضمين (`frame-ancestors 'none'` / `X-Frame-Options`) تُخفَّف **فقط** لنطاقات معاينة بيئة التطوير (`*.e2b.app` / `*.e2b.dev`) كي تظهر الصفحة العامة في لوحة المعاينة. أي نطاق حقيقي يحصل دائماً على المنع الكامل. كوكي لوحة الإدارة `SameSite=Strict` لذلك **افتح الموقع في تبويب مستقل** لتسجيل الدخول للإدارة.

## هيكل المشروع

```
src/
  proxy.ts                 CSP بـ nonce، فحص Origin (CSRF/CORS)، حماية مبكرة لمسارات الأدمن
  db/schema.ts             الجداول + القيود + الفهارس + RLS
  lib/                     auth, rate-limit, storage, upload, validation(Zod), orders, audit, mfa, crypto…
  app/(site)/              الصفحات العامة: الرئيسية، المنيو، السلة، حالة الطلب، التتبع
  app/admin/               الدخول، MFA، الأمان، ولوحة الإدارة (panel)
  app/api/                 واجهات API (public + admin) — كل واحدة تتحقق من الصلاحية على الخادم
drizzle/                   SQL migrations
scripts/                   create-admin, seed, security-tests, backup
supabase/storage-setup.sql إعداد الـ Buckets
```

## الجداول

`users` · `admin_roles` · `sessions` · `categories` · `products` · `payment_methods` · `orders` · `order_items` · `payment_receipts` · `site_settings` · `audit_logs` — إضافةً إلى `rate_limits` و`stored_files` (تخزين بديل). المبالغ بالقروش (أعداد صحيحة) مع قيود CHECK تضمن `العربون + المتبقي = الإجمالي`.

## النسخ الاحتياطي والمراقبة

* Supabase: فعّل Daily Backups / PITR. نسخة يدوية: `DATABASE_URL=... ./scripts/backup.sh` (تحتوي بيانات عملاء — خزّنها مشفّرة ولا تنشرها).
* سجل التدقيق داخل لوحة الإدارة (`/admin/audit`) يُبرز محاولات الدخول الفاشلة والأقفال؛ ويظهر تنبيه في لوحة التحكم عند وجود محاولات خلال 24 ساعة.
* أخطاء الخادم تُسجَّل بدون أي بيانات حساسة في Vercel Logs. يُنصح بإضافة Sentry/Vercel Alerts (لم تُضبط افتراضياً).

## قائمة الإطلاق (قبل استقبال طلبات حقيقية)

- [ ] ضبط `DATABASE_URL` و`APP_SECRET` وبقية المتغيرات في Vercel، و`INSECURE_COOKIES` غير مفعّل.
- [ ] تنفيذ المخطط + `supabase/storage-setup.sql` وضبط مفاتيح Supabase.
- [ ] إنشاء حساب المالك وتفعيل MFA.
- [ ] استبدال/حذف الأصناف التجريبية وإدخال المنيو والأسعار الحقيقية (تختفي علامة «تجريبي» تلقائياً).
- [ ] إدخال بيانات حسابات الدفع الحقيقية (Vodafone Cash / InstaPay / بنك) من «الدفع والعربون».
- [ ] إدخال رقم الهاتف وواتساب والعنوان وساعات العمل من «إعدادات الموقع» (تظهر الأزرار فقط بعد ذلك).
- [ ] رفع الشعار وصورة الصفحة الرئيسية الحقيقيين.
- [ ] إجراء طلب تجريبي كامل (طلب ← إيصال ← قبول ← تسليم) على الإنتاج.
- [ ] تفعيل النسخ الاحتياطي، و(اختياري) Turnstile وSentry.
