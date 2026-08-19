import { describe, it, expect, afterEach } from "vitest";
import { getAppBaseUrl, qrPageUrl } from "@/lib/qr-url";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
});

describe("getAppBaseUrl", () => {
  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    expect(getAppBaseUrl()).toBe("https://example.com");
  });
});

describe("qrPageUrl", () => {
  it("builds a /q/{token} url from the base", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    expect(qrPageUrl("abc-token")).toBe("https://example.com/q/abc-token");
  });
});
