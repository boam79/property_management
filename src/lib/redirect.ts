/** 내부 경로만 허용: `/`로 시작하고 `//`로 시작하지 않음 */
export function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}
