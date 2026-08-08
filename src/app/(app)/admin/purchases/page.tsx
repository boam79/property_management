import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PurchasesMovedPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1 className="text-xl font-semibold">구매이력은 로컬 앱으로 이전됨</h1>
      <p className="text-sm text-muted-foreground">
        구매이력·구매통계는 웹에서 더 이상 사용하지 않습니다. PC에 설치한{" "}
        <strong>구매이력</strong> 앱에서 관리하세요.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <code className="text-foreground">apps/purchase-desktop</code> 에서{" "}
          <code className="text-foreground">npm run tauri:dev</code> 또는 설치
          파일로 실행
        </li>
        <li>필요 시 예전 웹 CSV를 앱의 「CSV 가져오기」로 이관</li>
      </ol>
      <Link href="/admin" className={cn(buttonVariants({ size: "sm" }))}>
        대시보드로
      </Link>
    </div>
  );
}
