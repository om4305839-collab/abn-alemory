"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";

export function OrdersToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    const r = await apiRequest("/api/admin/settings", { method: "PUT", json: { ordersEnabled: !enabled } });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error);
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${enabled ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
        {enabled ? "● استقبال الطلبات مفتوح" : "● استقبال الطلبات متوقف"}
      </span>
      <button className={`btn btn-sm ${enabled ? "btn-danger" : "btn-primary"}`} onClick={toggle} disabled={busy}>
        {enabled ? "إيقاف مؤقت" : "استئناف الاستقبال"}
      </button>
      {error && <span className="text-xs font-bold text-rose-700">{error}</span>}
    </div>
  );
}
