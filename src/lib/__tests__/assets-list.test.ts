import { describe, it, expect } from "vitest";
import {
  parseAssetsPage,
  assetsTotalPages,
  assetsRange,
  buildAssetsListHref,
} from "@/lib/assets-list";

describe("parseAssetsPage", () => {
  it("defaults invalid/missing values to page 1", () => {
    expect(parseAssetsPage(undefined)).toBe(1);
    expect(parseAssetsPage("")).toBe(1);
    expect(parseAssetsPage("0")).toBe(1);
    expect(parseAssetsPage("-3")).toBe(1);
    expect(parseAssetsPage("abc")).toBe(1);
  });

  it("parses valid page numbers", () => {
    expect(parseAssetsPage("2")).toBe(2);
    expect(parseAssetsPage("10")).toBe(10);
  });
});

describe("assetsTotalPages", () => {
  it("returns at least 1 page", () => {
    expect(assetsTotalPages(0)).toBe(1);
    expect(assetsTotalPages(1)).toBe(1);
    expect(assetsTotalPages(50)).toBe(1);
  });

  it("ceils to page size boundaries", () => {
    expect(assetsTotalPages(51)).toBe(2);
    expect(assetsTotalPages(200)).toBe(4);
  });
});

describe("assetsRange", () => {
  it("computes 0-based inclusive ranges", () => {
    expect(assetsRange(1)).toEqual({ from: 0, to: 49 });
    expect(assetsRange(2)).toEqual({ from: 50, to: 99 });
  });
});

describe("buildAssetsListHref", () => {
  it("omits page=1 and empty filters", () => {
    expect(buildAssetsListHref({})).toBe("/assets");
    expect(buildAssetsListHref({ page: "1" })).toBe("/assets");
  });

  it("keeps filters and encodes query", () => {
    expect(buildAssetsListHref({ page: "2" })).toBe("/assets?page=2");
    expect(
      buildAssetsListHref({ q: "노트북", status: "IN_USE", page: "3" })
    ).toBe("/assets?q=%EB%85%B8%ED%8A%B8%EB%B6%81&status=IN_USE&page=3");
  });

  it("applies overrides (e.g. reset to page 1)", () => {
    expect(
      buildAssetsListHref({ status: "IN_USE", page: "2" }, { page: "1" })
    ).toBe("/assets?status=IN_USE");
    expect(
      buildAssetsListHref({ unlinked: "1", page: "2" }, { page: "3" })
    ).toBe("/assets?unlinked=1&page=3");
  });
});
