import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function PurchaseStatisticsMovedPage() {
  await requireAdmin();
  redirect("/admin/purchases");
}
