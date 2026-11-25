import Link from "next/link";
import { desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/labels";

export const metadata = { title: "سجل التدقيق" };

const PREFIXES = ["auth.", "order.", "product.", "payment_method.", "settings.", "receipt.", "media."];
const SUSPICIOUS = new Set(["auth.login_failed", "auth.account_locked", "auth.mfa_failed"]);

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ prefix?: string }> }) {
  await requireAdminPage("audit.read");
  const { prefix } = await searchParams;
  const active = PREFIXES.find((p) => p === prefix);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      ipHash: auditLogs.ipHash,
      createdAt: auditLogs.createdAt,
      actor: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(active ? like(auditLogs.action, `${active}%`) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(150);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-brown">سجل التدقيق</h1>
      <p className="text-sm text-mocha">يسجّل محاولات الدخول والتغييرات الإدارية وعرض الإيصالات. لا تُخزَّن كلمات المرور ولا الأسرار، وتُخزَّن عناوين IP بصيغة مجزّأة (Hash) فقط.</p>
      <nav className="flex flex-wrap gap-2" aria-label="تصفية السجل">
        <Link href="/admin/audit" className={`btn btn-sm ${!active ? "btn-primary" : "btn-outline"}`}>الكل</Link>
        {PREFIXES.map((p) => (
          <Link key={p} href={`/admin/audit?prefix=${encodeURIComponent(p)}`} className={`btn btn-sm ${active === p ? "btn-primary" : "btn-outline"}`} dir="ltr">{p}*</Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-sand text-brown">
            <tr>
              <th className="p-3">الوقت</th>
              <th className="p-3">الإجراء</th>
              <th className="p-3">المستخدم</th>
              <th className="p-3">الكيان</th>
              <th className="p-3">IP (hash)</th>
              <th className="p-3">تفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {rows.map((r) => (
              <tr key={r.id} className={SUSPICIOUS.has(r.action) ? "bg-rose-50" : ""}>
                <td className="p-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td className="p-3 font-bold" dir="ltr">{r.action}</td>
                <td className="p-3" dir="ltr">{r.actor ?? "—"}</td>
                <td className="p-3" dir="ltr">{[r.entityType, r.entityId].filter(Boolean).join(":") || "—"}</td>
                <td className="p-3 font-mono text-xs" dir="ltr">{r.ipHash?.slice(0, 10) ?? "—"}</td>
                <td className="max-w-xs truncate p-3 font-mono text-xs" dir="ltr" title={JSON.stringify(r.metadata)}>{JSON.stringify(r.metadata)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-mocha">لا توجد سجلات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
