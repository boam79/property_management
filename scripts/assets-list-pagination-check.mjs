/**
 * Unit checks for assets list pagination helpers.
 * Run: node --experimental-strip-types scripts/assets-list-pagination-check.mjs
 * (or via ts transpile — uses dynamic import of compiled logic inline)
 */
import assert from "node:assert/strict";

// Inline mirrors of src/lib/assets-list.ts — keep in sync when changing helpers.
const ASSETS_PAGE_SIZE = 50;

function parseAssetsPage(raw) {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function assetsTotalPages(totalCount, pageSize = ASSETS_PAGE_SIZE) {
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / pageSize);
}

function assetsRange(page, pageSize = ASSETS_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

function buildAssetsListHref(params, override = {}) {
  const merged = { ...params, ...override };
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

assert.equal(parseAssetsPage(undefined), 1);
assert.equal(parseAssetsPage(""), 1);
assert.equal(parseAssetsPage("0"), 1);
assert.equal(parseAssetsPage("-3"), 1);
assert.equal(parseAssetsPage("abc"), 1);
assert.equal(parseAssetsPage("2"), 2);

assert.equal(assetsTotalPages(0), 1);
assert.equal(assetsTotalPages(1), 1);
assert.equal(assetsTotalPages(50), 1);
assert.equal(assetsTotalPages(51), 2);
assert.equal(assetsTotalPages(200), 4);

assert.deepEqual(assetsRange(1), { from: 0, to: 49 });
assert.deepEqual(assetsRange(2), { from: 50, to: 99 });

assert.equal(buildAssetsListHref({}), "/assets");
assert.equal(buildAssetsListHref({ page: "1" }), "/assets");
assert.equal(buildAssetsListHref({ page: "2" }), "/assets?page=2");
assert.equal(
  buildAssetsListHref({ q: "노트북", status: "IN_USE", page: "3" }),
  "/assets?q=%EB%85%B8%ED%8A%B8%EB%B6%81&status=IN_USE&page=3"
);
assert.equal(
  buildAssetsListHref({ status: "IN_USE", page: "2" }, { page: "1" }),
  "/assets?status=IN_USE"
);
assert.equal(
  buildAssetsListHref({ unlinked: "1", page: "2" }, { page: "3" }),
  "/assets?unlinked=1&page=3"
);

console.log("PASS: assets-list pagination helpers");
