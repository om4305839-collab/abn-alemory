import { asc } from "drizzle-orm";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DepositEditor, PaymentsManager } from "./PaymentsManager";

export const metadata = { title: "الدفع والعربون" };

export default async function PaymentsPage() {
  await requireAdminPage("payments.manage");
  const [methods, settings] = await Promise.all([
    db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),
    getSettings(),
  ]);
  return (
    <div className="space-y-10">
      <DepositEditor initial={settings.depositPercentages} />
      <PaymentsManager
        methods={methods.map((m) => ({
          id: m.id,
          name: m.name,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          instructions: m.instructions,
          isActive: m.isActive,
          sortOrder: m.sortOrder,
        }))}
      />
    </div>
  );
}
