import Link from "next/link";
import { redirect } from "next/navigation";
import { getPageAuth } from "@/lib/auth";
import { MfaSetup, PasswordForm } from "./SecurityClient";

export const metadata = { title: "الأمان" };

export default async function AdminSecurityPage() {
  const auth = await getPageAuth();
  if (!auth || !auth.role) redirect("/admin/login");
  if (!auth.mfaVerified) redirect("/admin/mfa");
  const forced = auth.mustChangePassword;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card w-full max-w-lg space-y-6 p-8">
        <div className="text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">🛡️</div>
          <h1 className="text-2xl font-extrabold text-brown">أمان الحساب</h1>
          <p className="mt-1 text-sm text-mocha" dir="ltr">{auth.email}</p>
        </div>

        <PasswordForm forced={forced} />

        {auth.mfaEnabled ? (
          <p className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
            المصادقة الثنائية مفعّلة على حسابك ✓ (لإعادة تعيينها عند فقدان الجهاز استخدم سكربت الإدارة على الخادم).
          </p>
        ) : (
          <div className="border-t border-sand pt-6">
            <MfaSetup step={forced ? "٢." : ""} />
          </div>
        )}

        {!forced && auth.mfaEnabled && (
          <div className="text-center">
            <Link href="/admin" className="btn btn-primary">الذهاب إلى لوحة التحكم</Link>
          </div>
        )}
      </div>
    </div>
  );
}
