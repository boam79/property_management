import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PurchaseStatisticsCharts } from "@/components/purchase-statistics-charts";
import { buttonVariants } from "@/components/ui/button";
import type { PurchaseHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function countBy(rows: PurchaseHistory[], keyFn: (r: PurchaseHistory) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ko"));
}

function pct(part: number, whole: number) {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function PurchaseStatisticsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_histories")
    .select("id, item_name, purchase_date, department, created_at")
    .order("purchase_date", { ascending: false })
    .limit(10000);

  if (error) {
    console.error("[purchase statistics]", error.message);
  }

  const rows = (data ?? []) as PurchaseHistory[];
  const now = new Date();
  const monthStart = toDateStr(startOfMonth(now));
  const yearStart = toDateStr(startOfYear(now));

  const total = rows.length;
  const thisMonth = rows.filter((r) => r.purchase_date >= monthStart).length;
  const thisYear = rows.filter((r) => r.purchase_date >= yearStart).length;

  const byMonth = countBy(rows, (r) => r.purchase_date.slice(0, 7));
  const byItem = countBy(rows, (r) => r.item_name).slice(0, 30);
  const byDept = countBy(rows, (r) => r.department).slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">구매통계</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            차트와 요약으로 구매 현황을 한눈에 봅니다. (최대 1만 건)
          </p>
        </div>
        <Link
          href="/admin/purchases"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          구매이력
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="전체 구매건수"
          value={total}
          hint="조회 범위 내"
          accent="bg-teal-600"
        />
        <SummaryCard
          label="이번 달"
          value={thisMonth}
          hint={`전체 대비 ${pct(thisMonth, total)}`}
          accent="bg-sky-600"
        />
        <SummaryCard
          label="올해"
          value={thisYear}
          hint={`전체 대비 ${pct(thisYear, total)}`}
          accent="bg-amber-600"
        />
      </div>

      <PurchaseStatisticsCharts
        byMonth={byMonth}
        byDept={byDept}
        byItem={byItem}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className={cn("h-1", accent)} />
      <div className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
