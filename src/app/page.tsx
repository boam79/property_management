import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          QR 자산관리
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          일반 비품·IT·의료장비 등록 및 관리 MVP
        </p>
      </div>
      <Link href="/login" className={cn(buttonVariants())}>
        로그인
      </Link>
    </main>
  );
}
