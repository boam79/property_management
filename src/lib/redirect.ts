/**
 * 로그인 후 redirect 파라미터용 안전 내부 경로 검증.
 * `/\\evil.com` → URL 해석 시 외부 호스트로 열리는 open-redirect 를 차단한다.
 */
export function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;

  let decoded = path;
  try {
    // 이중 인코딩 완화: 최대 2회
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
  // 프로토콜 상대·백슬래시·탭 등
  if (/^\/[\s\\/]/.test(decoded)) return false;
  // 허용 문자만 (경로·쿼리)
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(decoded)) return false;

  // 앱 내부 경로 allowlist
  const pathname = decoded.split("?")[0] ?? decoded;
  const allowed =
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/q/") ||
    pathname === "/login";
  if (!allowed) return false;

  return true;
}
