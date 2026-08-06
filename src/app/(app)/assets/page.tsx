import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ASSETS_PAGE_SIZE,
  assetsRange,
  assetsTotalPages,
  buildAssetsListHref,
  parseAssetsPage,
  type AssetsListParams,
} from "@/lib/assets-list";
import {
  ASSET_STATUSES,
  ASSET_TYPES,
} from "@/lib/constants";
import type { Asset } from "@/lib/types";
import { AssetsTableWithBulk } from "@/components/assets-table-with-bulk";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, escapeIlikePattern } from "@/lib/utils";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    asset_type?: string;
    status?: string;
    location?: string;
    unlinked?: string;
    page?: string;
  }>;
}) {
  const params = (await searchParams) as AssetsListParams;
  const page = parseAssetsPage(params.page);
  const { from, to } = assetsRange(page);
  const current = await getCurrentProfile();
  const isAdmin = current?.profile.role === "ADMIN";
  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.asset_type) {
    query = query.eq("asset_type", params.asset_type);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.location) {
    if (params.location === "미지정") {
      query = query.or("location.is.null,location.eq.");
    } else {
      query = query.eq("location", params.location);
    }
  }
  if (params.unlinked === "1") {
    query = query.is("qr_code_id", null);
  }
  if (params.q) {
    const q = escapeIlikePattern(params.q.trim());
    query = query.or(
      `asset_no.ilike.%${q}%,name.ilike.%${q}%,location.ilike.%${q}%,serial_no.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[assets list]", error.message, { page, from, to });
  }
  const assets = (data ?? []) as Asset[];
  const totalCount = count ?? 0;
  const totalPages = assetsTotalPages(totalCount);
  // Past-last-page visits still show empty rows; clamp label/nav to last page
  const displayPage = page > totalPages ? totalPages : page;
  const displayFrom = (displayPage - 1) * ASSETS_PAGE_SIZE;
  const rangeStart = totalCount === 0 ? 0 : displayFrom + 1;
  const rangeEnd = Math.min(displayFrom + ASSETS_PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">자산목록</h1>
        <p className="text-sm text-muted-foreground">
          검색·필터로 자산을 찾으세요.
        </p>
      </div>

      <form className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="q">검색</Label>
          <Input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="자산번호, 이름, 위치…"
          />
        </div>
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
            placeholder="위치"
          />
        </div>
        {params.unlinked === "1" ? (
          <input type="hidden" name="unlinked" value="1" />
        ) : null}
        {/* 필터 적용 시 1페이지로 */}
        <input type="hidden" name="page" value="1" />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">적용</Button>
          <Link href="/assets" className={cn(buttonVariants({ variant: "outline" }))}>
            초기화
          </Link>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-destructive">
          목록을 불러오지 못했습니다: {error.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p data-testid="assets-total">
          전체 <span className="font-medium text-foreground">{totalCount}</span>건
          {totalCount > 0 ? (
            <>
              {" "}
              · {rangeStart}–{rangeEnd} 표시 (페이지 {displayPage}/{totalPages},{" "}
              {ASSETS_PAGE_SIZE}건씩)
            </>
          ) : null}
        </p>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2" data-testid="assets-export">
            <a
              href={buildExportHref(params, "xlsx")}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Excel 내보내기
            </a>
            <a
              href={buildExportHref(params, "csv")}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              CSV 내보내기
            </a>
          </div>
        ) : null}
      </div>

      <AssetsTableWithBulk
        key={`assets-page-${displayPage}-${params.q ?? ""}-${params.status ?? ""}-${params.asset_type ?? ""}-${params.location ?? ""}-${params.unlinked ?? ""}`}
        assets={assets}
        enableBulk={!!isAdmin}
      />

      <nav
        className="flex flex-wrap items-center justify-between gap-2"
        aria-label="자산 목록 페이지"
        data-testid="assets-pagination"
      >
        {displayPage > 1 ? (
          <Link
            href={buildAssetsListHref(params, { page: String(displayPage - 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            data-testid="assets-prev"
          >
            이전
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-40"
            )}
            aria-disabled="true"
            data-testid="assets-prev-disabled"
          >
            이전
          </span>
        )}

        <span className="text-sm text-muted-foreground" data-testid="assets-page-label">
          {displayPage} / {totalPages}
        </span>

        {displayPage < totalPages ? (
          <Link
            href={buildAssetsListHref(params, { page: String(displayPage + 1) })}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            data-testid="assets-next"
          >
            다음
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-40"
            )}
            aria-disabled="true"
            data-testid="assets-next-disabled"
          >
            다음
          </span>
        )}
      </nav>
    </div>
  );
}

function buildExportHref(
  params: AssetsListParams,
  format: "xlsx" | "csv"
): string {
  const q = new URLSearchParams();
  q.set("format", format);
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.asset_type) q.set("asset_type", params.asset_type);
  if (params.status) q.set("status", params.status);
  if (params.location) q.set("location", params.location);
  if (params.unlinked === "1") q.set("unlinked", "1");
  return `/api/admin/assets/export?${q.toString()}`;
}
