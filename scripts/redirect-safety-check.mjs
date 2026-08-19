/**
 * Open-redirect 회귀 방지 (로컬 단위 검증)
 */

// Plain reimplementation mirroring src/lib/redirect.ts for Node without TS loader
function isSafeRedirectPath(path) {
  if (!path || typeof path !== "string") return false;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
    decoded = decodeURIComponent(decoded);
  } catch {
    return false;
  }
  if (!decoded.startsWith("/")) return false;
  if (decoded.startsWith("//")) return false;
  if (decoded.includes("://")) return false;
  if (decoded.includes("\\")) return false;
  if (/[\0\r\n]/.test(decoded)) return false;
  if (/^\/[\s\\/]/.test(decoded)) return false;
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(decoded)) return false;
  const pathname = decoded.split("?")[0] ?? decoded;
  const allowed =
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/q/") ||
    pathname === "/login";
  return allowed;
}

const cases = [
  ["/", true],
  ["/assets", true],
  ["/admin/qr", true],
  ["/scan", true],
  ["/q/abc-uuid", true],
  ["/login?x=1", true],
  ["//evil.com", false],
  ["/\\evil.com", false],
  ["/%5Cevil.com", false],
  ["/%2F%2Fevil.com", false],
  ["https://evil.com", false],
  ["/assets\n/evil", false],
  ["/not-allowed", false],
  ["", false],
  [null, false],
];

let failed = 0;
for (const [input, expect] of cases) {
  const got = isSafeRedirectPath(input);
  if (got !== expect) {
    console.error("FAIL", JSON.stringify(input), "expected", expect, "got", got);
    failed++;
  }
}

// URL constructor trap check
const trap = "/\\evil.com";
if (isSafeRedirectPath(trap)) {
  console.error("FAIL trap still considered safe:", trap);
  failed++;
} else {
  console.log("OK blocked backslash open-redirect");
}

if (failed) {
  console.error(`${failed} redirect safety checks failed`);
  process.exit(1);
}
console.log(`redirect-safety-check: ${cases.length} cases OK`);
