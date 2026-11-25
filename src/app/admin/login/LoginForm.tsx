"use client";
import { useState } from "react";
import { Alert } from "@/components/admin/ui";
import { Turnstile } from "@/components/Turnstile";
import { apiRequest } from "@/lib/client-api";

export function LoginForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await apiRequest<{ next: string }>("/api/admin/login", {
      json: { email, password, turnstileToken: captcha || undefined },
    });
    if (!r.ok) {
      setBusy(false);
      setPassword("");
      setError(r.error);
      return;
    }
    window.location.href = r.data.next;
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" type="email" dir="ltr" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">كلمة المرور</label>
        <input id="password" type="password" dir="ltr" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setCaptcha} />}
      {error && <Alert>{error}</Alert>}
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? "جاري التحقق…" : "تسجيل الدخول"}</button>
    </form>
  );
}
