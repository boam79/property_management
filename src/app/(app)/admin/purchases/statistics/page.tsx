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
  const byItem = countBy(rows, (r) => r.item_name).slice(0, 8);
  const byDept = countBy(rows, (r) => r.department).slice(0, 8);

  return (
    <div className="flex h-[calc(100dvh-6.75rem)] flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold">구매통계</h1>
          <p className="text-xs text-muted-foreground">한 화면 요약 · 최대 1만 건</p>
        </div>
        <Link
          href="/admin/purchases"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          구매이력
        </Link>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-2">
        <Kpi label="전체" value={total} hint="조회 범위" accent="bg-teal-600" />
        <Kpi
          label="이번 달"
          value={thisMonth}
          hint={pct(thisMonth, total)}
          accent="bg-sky-600"
        />
        <Kpi
          label="올해"
          value={thisYear}
          hint={pct(thisYear, total)}
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

function Kpi({
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
    <div className="flex items-center gap-2 overflow-hidden rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
      <span className={cn("h-8 w-1 shrink-0 rounded-full", accent)} />
      <div className="min-w-0">
        <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-semibold leading-none tracking-tight">
          {value}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        </p>
      </div>
    </div>
  );
}
