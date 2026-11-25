"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/admin/ui";
import { apiRequest } from "@/lib/client-api";

export function MfaForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await apiRequest<{ next: string }>("/api/admin/mfa", { json: { code } });
    if (!r.ok) {
      setBusy(false);
      setCode("");
      setError(r.error);
      if (r.status === 401 && r.error.includes("انتهت")) router.replace("/admin/login");
      return;
    }
    window.location.href = r.data.next;
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <input className="input text-center text-2xl tracking-[0.5em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="رمز التحقق" autoFocus required />
      {error && <Alert>{error}</Alert>}
      <button className="btn btn-primary w-full py-3" disabled={busy || code.length !== 6}>{busy ? "جاري التحقق…" : "تأكيد"}</button>
      <a href="/admin/login" className="block text-center text-sm font-bold text-mocha underline">العودة لتسجيل الدخول</a>
    </form>
  );
}
