"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";

export function ImageUploader({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (url: string) => void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setError("الصيغ المسموحة: JPG, PNG, WebP");
    if (f.size > 4 * 1024 * 1024) return setError("الحجم الأقصى 4 ميجابايت");
    setBusy(true);
    const form = new FormData();
    form.set("file", f);
    const r = await apiRequest<{ url: string }>("/api/admin/media", { form });
    setBusy(false);
    if (r.ok) onChange(r.data.url);
    else setError(r.error);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-tan bg-sand">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl" aria-hidden="true">🖼️</span>}
        </div>
        <div className="space-y-1">
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm file:ml-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-bold file:text-brown" aria-label={label} />
          <p className="text-xs text-mocha">{busy ? "جاري الرفع والمعالجة…" : "JPG / PNG / WebP حتى 4 ميجابايت. تُعاد معالجة الصورة تلقائياً للأمان."}</p>
          {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
