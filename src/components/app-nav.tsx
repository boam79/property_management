import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

export function AppNav({ role }: { role: UserRole }) {
  const isAdmin = role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/assets" className="mr-2 font-semibold tracking-tight">
          QR 자산관리
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          <Link
            href="/assets"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            자산목록
          </Link>
          <Link
            href="/scan"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            QR스캔
          </Link>
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                대시보드
              </Link>
              <Link
                href="/admin/qr"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                QR생성
              </Link>
              <Link
                href="/admin/import"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                임포트
              </Link>
              <Link
                href="/admin/link-qr"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                QR연결
              </Link>
              <Link
                href="/admin/users"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                사용자
              </Link>
              <Link
                href="/admin/audit"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                감사로그
              </Link>
            </>
          ) : null}
        </nav>
        <form action="/logout" method="get">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
