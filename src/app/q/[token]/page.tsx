import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QrRegisterForm } from "@/components/qr-register-form";
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  QR_STATUS_LABELS,
} from "@/lib/constants";
import type { Asset, QrCode } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function QrTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const current = await getCurrentProfile();

  if (!current) {
    redirect(`/login?redirect=${encodeURIComponent(`/q/${token}`)}`);
  }

  const supabase = await createClient();
  // unused QR 목록 노출 방지: exact-token RPC 우선 (마이그레이션 전 호환 fallback)
  let qr: QrCode | null = null;
  const { data: qrRows, error } = await supabase.rpc("get_qr_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("[q page rpc]", error.message);
    const { data: fallback, error: fallbackErr } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (fallbackErr) {
      console.error("[q page fallback]", fallbackErr.message);
    }
    qr = (fallback as QrCode | null) ?? null;
  } else {
    qr = (Array.isArray(qrRows) ? qrRows[0] : qrRows) as QrCode | null;
  }

  if (!qr) {
    return (
      <QrShell>
        <h1 className="text-xl font-semibold">QR을 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          유효하지 않거나 존재하지 않는 QR입니다.
        </p>
        <Link href="/assets" className={cn(buttonVariants({ variant: "outline" }))}>
          자산목록
        </Link>
      </QrShell>
    );
  }

  const code = qr;

  if (code.status === "retired") {
    return (
      <QrShell>
        <h1 className="text-xl font-semibold">폐기된 QR</h1>
        <p className="text-sm text-muted-foreground">
          이 QR({code.display_code})은 폐기되어 등록할 수 없습니다.
        </p>
      </QrShell>
    );
  }

  if (code.status === "assigned" && code.asset_id) {
    const { data: asset } = await supabase
      .from("assets")
      .select("*")
      .eq("id", code.asset_id)
      .maybeSingle();

    if (!asset) {
      return (
        <QrShell>
          <h1 className="text-xl font-semibold">연결된 자산 없음</h1>
          <p className="text-sm text-muted-foreground">
            QR은 연결 상태이지만 자산 데이터를 찾을 수 없습니다.
          </p>
        </QrShell>
      );
    }

    const a = asset as Asset;
    return (
      <QrShell>
        <h1 className="text-xl font-semibold">등록된 자산</h1>
        <p className="text-sm text-muted-foreground">
          QR {code.display_code} · {QR_STATUS_LABELS[code.status]}
        </p>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">자산번호</dt>
            <dd className="font-medium">{a.asset_no}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">자산명</dt>
            <dd className="font-medium">{a.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">구분 / 상태</dt>
            <dd>
              {ASSET_TYPE_LABELS[a.asset_type]} · {ASSET_STATUS_LABELS[a.status]}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">위치</dt>
            <dd>{a.location || "미지정"}</dd>
          </div>
        </dl>
        <Link href={`/assets/${a.id}`} className={cn(buttonVariants())}>
          상세·수정
        </Link>
      </QrShell>
    );
  }

  return (
    <QrShell>
      <div>
        <h1 className="text-xl font-semibold">자산 등록</h1>
        <p className="text-sm text-muted-foreground">
          빈 QR ({code.display_code})에 자산을 등록합니다.
        </p>
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <QrRegisterForm token={token} />
      </div>
    </QrShell>
  );
}

function QrShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Link href="/assets" className="text-sm font-semibold tracking-tight">
        QR 자산관리
      </Link>
      {children}
    </main>
  );
}
