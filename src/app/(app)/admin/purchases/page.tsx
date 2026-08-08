import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PurchaseCreateForm } from "@/components/purchase-create-form";
import { PurchaseRowActions } from "@/components/purchase-row-actions";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseHistory } from "@/lib/types";
import { cn, escapeIlikePattern } from "@/lib/utils";

const PAGE_SIZE = 50;

function buildHref(params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.department) sp.set("department", params.department);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/admin/purchases?${qs}` : "/admin/purchases";
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    department?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const department = params.department?.trim() ?? "";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("purchase_histories")
    .select("*", { count: "exact" })
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  if (q) {
    query = query.ilike("item_name", `%${escapeIlikePattern(q)}%`);
  }
  if (department) {
    query = query.ilike("department", `%${escapeIlikePattern(department)}%`);
  }
  if (from) {
    query = query.gte("purchase_date", from);
  }
  if (to) {
    query = query.lte("purchase_date", to);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[purchases]", error.message);
  }

  const rows = (data ?? []) as PurchaseHistory[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (department) exportQs.set("department", department);
  if (from) exportQs.set("from", from);
  if (to) exportQs.set("to", to);
  exportQs.set("format", "csv");
  const exportHref = `/api/admin/purchases/export?${exportQs.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">구매이력</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            품목·구매일자·사용부서를 관리합니다. 자산 목록과는 별도입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/purchases/statistics"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            구매통계
          </Link>
          <a
            href={exportHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            CSV 내보내기
          </a>
        </div>
      </div>

      <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">새 구매이력 등록</h2>
        <PurchaseCreateForm />
      </section>

      <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">검색·필터</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="q">품목</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="부분일치" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="department">사용부서</Label>
            <Input
              id="department"
              name="department"
              defaultValue={department}
              placeholder="부분일치"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="from">시작일</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">종료일</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
          <button
            type="submit"
            className={cn(buttonVariants({ size: "sm" }), "h-8")}
          >
            적용
          </button>
        </form>
      </section>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구매일자</TableHead>
              <TableHead>품목</TableHead>
              <TableHead>사용부서</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  구매이력이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.purchase_date}
                  </TableCell>
                  <TableCell className="text-sm">{row.item_name}</TableCell>
                  <TableCell className="text-sm">{row.department}</TableCell>
                  <TableCell className="text-right">
                    <PurchaseRowActions row={row} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          총 {total}건 · {page}/{totalPages} 페이지
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={buildHref({ q, department, from, to }, page - 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              이전
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={buildHref({ q, department, from, to }, page + 1)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              다음
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
