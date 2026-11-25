import { redirect } from "next/navigation";
import { getPageAuth } from "@/lib/auth";
import { turnstileEnabled } from "@/lib/turnstile";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "تسجيل الدخول" };

export default async function AdminLoginPage() {
  const auth = await getPageAuth();
  if (auth?.role && auth.mfaVerified) redirect("/admin");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <img src="/images/logo.svg" alt="" className="mx-auto mb-4 h-16 w-16 rounded-2xl" />
          <h1 className="text-2xl font-extrabold text-brown">لوحة إدارة كشري ابن العمراوي</h1>
          <p className="mt-1 text-sm text-mocha">للمصرّح لهم فقط</p>
        </div>
        <LoginForm turnstileSiteKey={turnstileEnabled() ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "") : ""} />
      </div>
    </div>
  );
}
