"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/admin/ui";
import { apiRequest } from "@/lib/client-api";

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return setMsg({ kind: "error", text: "تأكيد كلمة المرور غير مطابق." });
    setBusy(true);
    setMsg(null);
    const r = await apiRequest("/api/admin/security/password", {
      json: { currentPassword: current, newPassword: next },
    });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setCurrent("");
    setNext("");
    setAgain("");
    setMsg({ kind: "success", text: "تم تغيير كلمة المرور." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <h2 className="text-lg font-extrabold text-brown">{forced ? "١. غيّر كلمة المرور المؤقتة (إلزامي)" : "تغيير كلمة المرور"}</h2>
      {forced && <p className="text-xs leading-relaxed text-mocha">حسابك أُنشئ بكلمة مرور مؤقتة. اختر كلمة مرور جديدة قوية: 14 حرفاً على الأقل وتجمع 3 أنواع من (صغيرة، كبيرة، أرقام، رموز).</p>}
      <input type="password" dir="ltr" className="input" placeholder="كلمة المرور الحالية" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="كلمة المرور الحالية" required />
      <input type="password" dir="ltr" className="input" placeholder="كلمة المرور الجديدة" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="كلمة المرور الجديدة" required />
      <input type="password" dir="ltr" className="input" placeholder="تأكيد كلمة المرور الجديدة" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-label="تأكيد كلمة المرور الجديدة" required />
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "…" : "حفظ كلمة المرور"}</button>
    </form>
  );
}

export function MfaSetup({ step }: { step?: string }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError("");
    const r = await apiRequest<{ secret: string; qr: string }>("/api/admin/security/mfa/setup", { method: "POST", json: {} });
    setBusy(false);
    if (r.ok) setSetup(r.data);
    else setError(r.error);
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await apiRequest("/api/admin/security/mfa/enable", { json: { code } });
    if (r.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(r.error);
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-extrabold text-brown">{step ?? ""} المصادقة الثنائية (MFA)</h2>
        <p className="text-sm leading-relaxed text-mocha">
          لحماية لوحة الإدارة، فعّل المصادقة الثنائية باستخدام تطبيق مثل Google Authenticator أو Microsoft Authenticator أو Authy.
        </p>
        {error && <Alert>{error}</Alert>}
        <button className="btn btn-primary w-full" onClick={start} disabled={busy}>{busy ? "…" : "بدء الإعداد"}</button>
      </div>
    );
  }
  return (
    <form onSubmit={enable} className="space-y-4 text-center">
      <p className="text-sm text-mocha">امسح رمز QR بتطبيق المصادقة (أو أدخل المفتاح يدوياً).</p>
      <img src={setup.qr} alt="رمز QR لإعداد المصادقة الثنائية" width={224} height={224} className="mx-auto rounded-xl border border-sand" />
      <p className="text-xs text-mocha">المفتاح اليدوي:</p>
      <code className="block rounded-lg bg-sand p-2 text-sm font-bold tracking-widest break-all" dir="ltr">{setup.secret}</code>
      <p className="text-sm text-mocha">ثم أدخل الرمز الظاهر في التطبيق للتأكيد.</p>
      <input className="input text-center text-2xl tracking-[0.5em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="رمز التحقق" required />
      {error && <Alert>{error}</Alert>}
      <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "…" : "تفعيل المصادقة الثنائية"}</button>
    </form>
  );
}
