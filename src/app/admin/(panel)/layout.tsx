import type { ReactNode } from "react";
import { can, requireAdminPage } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { AdminNav } from "./AdminNav";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Server-side guard for EVERY panel page: session + MFA + role are verified before rendering.
  const auth = await requireAdminPage();
  const links = [
    { href: "/admin", label: "لوحة التحكم", show: true },
    { href: "/admin/orders", label: "الطلبات", show: can(auth.role, "orders.read") },
    { href: "/admin/products", label: "المنتجات والتصنيفات", show: can(auth.role, "products.manage") },
    { href: "/admin/payments", label: "الدفع والعربون", show: can(auth.role, "payments.manage") },
    { href: "/admin/settings", label: "إعدادات الموقع", show: can(auth.role, "settings.manage") },
    { href: "/admin/audit", label: "سجل التدقيق", show: can(auth.role, "audit.read") },
    { href: "/admin/security", label: "الأمان", show: true },
  ].filter((l) => l.show);

  return (
    <>
      <AdminNav links={links} email={auth.email} roleLabel={ROLE_LABELS[auth.role]} />
      <div className="container-page py-8">{children}</div>
    </>
  );
}
