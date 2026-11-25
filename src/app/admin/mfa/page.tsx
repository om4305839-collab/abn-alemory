import { redirect } from "next/navigation";
import { getPageAuth } from "@/lib/auth";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "التحقق بخطوتين" };

export default async function AdminMfaPage() {
  const auth = await getPageAuth();
  if (!auth || !auth.role) redirect("/admin/login");
  if (auth.mfaVerified) redirect("/admin");
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">🔐</div>
          <h1 className="text-2xl font-extrabold text-brown">التحقق بخطوتين</h1>
          <p className="mt-1 text-sm text-mocha">أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.</p>
        </div>
        <MfaForm />
      </div>
    </div>
  );
}
