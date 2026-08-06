import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "@/components/dashboard-charts";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
} from "@/lib/constants";
import type { Asset, DashboardStats } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    asset_type?: string;
    status?: string;
    location?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_asset_type: params.asset_type || null,
    p_status: params.status || null,
    p_location: params.location || null,
  });

  if (error) {
    console.error("[dashboard]", error.message);
  }

  const stats = (data ?? {
    total: 0,
    general_count: 0,
    it_count: 0,
    in_use_count: 0,
    repair_count: 0,
    unlinked_qr_count: 0,
    by_type: [],
    by_status: [],
    by_location: [],
    by_qr_link: [],
    daily_created: [],
    recent: [],
  }) as DashboardStats;

  const cards = [
    {
      title: "전체 자산",
      value: stats.total,
      href: buildAssetsHref(params, {}),
    },
    {
      title: "일반 비품",
      value: stats.general_count,
      href: buildAssetsHref(params, { asset_type: "GENERAL" }),
    },
    {
      title: "IT 자산",
      value: stats.it_count,
      href: buildAssetsHref(params, { asset_type: "IT" }),
    },
    {
      title: "사용 중",
      value: stats.in_use_count,
      href: buildAssetsHref(params, { status: "IN_USE" }),
    },
    {
      title: "수리 중",
      value: stats.repair_count,
      href: buildAssetsHref(params, { status: "REPAIR" }),
    },
    {
      title: "QR 미연결",
      value: stats.unlinked_qr_count,
      href: buildAssetsHref(params, { unlinked: "1" }),
    },
  ];

  const recent = (stats.recent ?? []) as Asset[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">관리자 대시보드</h1>
          <p className="text-xs text-muted-foreground">
            자산 현황 요약 · 필터는 카드·차트·표에 공통 적용
          </p>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="pt-(--card-spacing)">
          <form className="grid gap-2 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="asset_type">구분</Label>
              <select
                id="asset_type"
                name="asset_type"
                defaultValue={params.asset_type ?? ""}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">전체</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">상태</Label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? ""}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">전체</option>
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">위치</Label>
              <Input
                id="location"
                name="location"
                defaultValue={params.location ?? ""}
                placeholder="위치 또는 미지정"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                적용
              </Button>
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 sm:flex-none")}
              >
                전체 초기화
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card size="sm" className="border-destructive/40 bg-destructive/5 ring-destructive/30">
          <CardContent className="pt-(--card-spacing)">
            <p className="text-sm text-destructive">
              집계를 불러오지 못했습니다: {error.message}
            </p>
            <Link
              href="/admin"
              className={cn(buttonVariants({ size: "sm" }), "mt-2 inline-flex")}
            >
              재시도
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className="group block">
            <Card
              size="sm"
              className="h-full transition group-hover:ring-foreground/25"
            >
              <CardHeader className="gap-0.5">
                <CardDescription className="text-xs">{c.title}</CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums">
                  {c.value}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <DashboardCharts stats={stats} />

      <Card size="sm">
        <CardHeader className="border-b py-2">
          <CardTitle>최근 등록 자산</CardTitle>
        </CardHeader>
        <CardContent className="max-h-44 overflow-auto px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">자산번호</TableHead>
                <TableHead>자산명</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>위치</TableHead>
                <TableHead className="pr-4">등록시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    등록된 데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-4">
                      <Link
                        href={`/assets/${a.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {a.asset_no}
                      </Link>
                    </TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{ASSET_TYPE_LABELS[a.asset_type]}</TableCell>
                    <TableCell>{ASSET_STATUS_LABELS[a.status]}</TableCell>
                    <TableCell>{a.location || "미지정"}</TableCell>
                    <TableCell className="pr-4">
                      {new Date(a.created_at).toLocaleString("ko-KR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function buildAssetsHref(
  base: { asset_type?: string; status?: string; location?: string },
  override: Record<string, string>
) {
  const q = new URLSearchParams();
  const merged = { ...base, ...override };
  if (merged.asset_type) q.set("asset_type", merged.asset_type);
  if (merged.status) q.set("status", merged.status);
  if (merged.location) q.set("location", merged.location);
  if (override.unlinked) q.set("unlinked", override.unlinked);
  const s = q.toString();
  return s ? `/assets?${s}` : "/assets";
}
