import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const byMonth = countBy(rows, (r) => r.purchase_date.slice(0, 7)).sort((a, b) =>
    b.key.localeCompare(a.key)
  );
  const byItem = countBy(rows, (r) => r.item_name).slice(0, 30);
  const byDept = countBy(rows, (r) => r.department).slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">구매통계</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            구매이력 기준 집계입니다. (최대 1만 건)
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
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">전체 구매건수</p>
          <p className="mt-1 text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">이번 달</p>
          <p className="mt-1 text-2xl font-semibold">{thisMonth}</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">올해</p>
          <p className="mt-1 text-2xl font-semibold">{thisYear}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">월별 구매건수</h2>
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>월</TableHead>
                <TableHead className="text-right">건수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byMonth.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    데이터 없음
                  </TableCell>
                </TableRow>
              ) : (
                byMonth.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.key}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-medium">품목별 구매횟수 (상위 30)</h2>
          <div className="rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>품목</TableHead>
                  <TableHead className="text-right">횟수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byItem.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      데이터 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  byItem.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.key}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">부서별 구매건수 (상위 30)</h2>
          <div className="rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>부서</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDept.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      데이터 없음
                    </TableCell>
                  </TableRow>
                ) : (
                  byDept.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>{r.key}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
