import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSafeRedirectPath } from "@/lib/redirect";

/** Next.js 16 proxy (replaces middleware convention). */
export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isLogin = pathname === "/login";
  const isProtected =
    pathname.startsWith("/assets") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/scan");

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectPath = `${pathname}${search}`;
    if (isSafeRedirectPath(redirectPath)) {
      loginUrl.searchParams.set("redirect", redirectPath);
    }
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (isLogin && user) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const dest =
      redirectParam && isSafeRedirectPath(redirectParam)
        ? redirectParam
        : "/assets";
    const redirectResponse = NextResponse.redirect(new URL(dest, request.url));
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
