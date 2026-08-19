import { describe, it, expect } from "vitest";
import { isSafeRedirectPath } from "@/lib/redirect";

describe("isSafeRedirectPath", () => {
  it("allows internal app paths", () => {
    for (const p of [
      "/",
      "/assets",
      "/assets?page=2",
      "/admin/qr",
      "/scan",
      "/q/550e8400-e29b-41d4-a716-446655440000",
      "/login?x=1",
    ]) {
      expect(isSafeRedirectPath(p)).toBe(true);
    }
  });

  it("blocks open-redirect and unsafe inputs", () => {
    for (const p of [
      "//evil.com",
      "/\\evil.com",
      "/%5Cevil.com",
      "/%2F%2Fevil.com",
      "https://evil.com",
      "/assets\n/evil",
      "/not-allowed",
      "",
      null,
      undefined,
    ]) {
      expect(isSafeRedirectPath(p)).toBe(false);
    }
  });
});
