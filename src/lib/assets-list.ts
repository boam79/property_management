/** Assets list query helpers (pagination + filter hrefs). */

export const ASSETS_PAGE_SIZE = 50;

export type AssetsListParams = {
  q?: string;
  asset_type?: string;
  status?: string;
  location?: string;
  unlinked?: string;
  page?: string;
};

/** 1-based page number; invalid/missing → 1. */
export function parseAssetsPage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function assetsTotalPages(totalCount: number, pageSize = ASSETS_PAGE_SIZE): number {
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / pageSize);
}

export function assetsRange(
  page: number,
  pageSize = ASSETS_PAGE_SIZE
): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

/** Build /assets?... preserving filters; omit page=1 for cleaner URLs. */
export function buildAssetsListHref(
  params: AssetsListParams,
  override: Partial<AssetsListParams> = {}
): string {
  const merged: AssetsListParams = { ...params, ...override };
  const q = new URLSearchParams();

  if (merged.q?.trim()) q.set("q", merged.q.trim());
  if (merged.asset_type) q.set("asset_type", merged.asset_type);
  if (merged.status) q.set("status", merged.status);
  if (merged.location) q.set("location", merged.location);
  if (merged.unlinked === "1") q.set("unlinked", "1");

  const page = parseAssetsPage(merged.page);
  if (page > 1) q.set("page", String(page));

  const s = q.toString();
  return s ? `/assets?${s}` : "/assets";
}
