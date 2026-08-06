import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssetEditForm } from "@/components/asset-edit-form";
import type { Asset, QrCode } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[asset detail]", error.message);
  }
  if (!asset) notFound();

  let qr: QrCode | null = null;
  if (asset.qr_code_id) {
    const { data } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("id", asset.qr_code_id)
      .maybeSingle();
    qr = data as QrCode | null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">자산 상세</h1>
          <p className="text-sm text-muted-foreground">{(asset as Asset).asset_no}</p>
        </div>
        <Link href="/assets" className={cn(buttonVariants({ variant: "outline" }))}>
          목록으로
        </Link>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-sm font-medium">QR 정보</h2>
        {qr ? (
          <p className="text-sm text-muted-foreground">
            코드: {qr.display_code} · 상태: {qr.status} ·{" "}
            <Link
              href={`/q/${qr.token}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              QR 페이지
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">QR 미연결</p>
        )}
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-sm font-medium">자산 수정</h2>
        <AssetEditForm asset={asset as Asset} />
      </div>
    </div>
  );
}
