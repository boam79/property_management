import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssetEditForm } from "@/components/asset-edit-form";
import { AssetPhotosPanel } from "@/components/asset-photos-panel";
import { AssetTransferForm } from "@/components/asset-transfer-form";
import {
  RetireQrButton,
  UnlinkQrButton,
} from "@/components/qr-lifecycle-actions";
import { QR_STATUS_LABELS } from "@/lib/constants";
import type { Asset, AssetPhoto, AuditLog, QrCode } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentProfile();
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

  const [{ data: suggestionRows }, { data: photoRows }, historyResult] =
    await Promise.all([
      supabase
        .from("assets")
        .select("category, location, department")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("asset_photos")
        .select("*")
        .eq("asset_id", id)
        .order("created_at", { ascending: false }),
      current?.profile.role === "ADMIN"
        ? supabase
            .from("audit_logs")
            .select("*")
            .eq("entity_type", "asset")
            .eq("entity_id", id)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as AuditLog[] }),
    ]);

  const historyRows = historyResult.data;

  const suggestions = {
    categories: uniqueStrings(
      (suggestionRows ?? []).map((r) => r.category as string | null)
    ),
    locations: uniqueStrings(
      (suggestionRows ?? []).map((r) => r.location as string | null)
    ),
    departments: uniqueStrings(
      (suggestionRows ?? []).map((r) => r.department as string | null)
    ),
  };

  const photos = (photoRows ?? []) as AssetPhoto[];
  const signedUrls: Record<string, string> = {};
  for (const p of photos) {
    const { data: signed } = await supabase.storage
      .from("asset-photos")
      .createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) signedUrls[p.id] = signed.signedUrl;
  }

  const history = (historyRows ?? []) as AuditLog[];
  const isAdmin = current?.profile.role === "ADMIN";
  // audit_logs RLS is admin-only; REGISTER would always see empty history
  const canViewHistory = isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">자산 상세</h1>
          <p className="text-sm text-muted-foreground">
            {(asset as Asset).asset_no}
          </p>
        </div>
        <Link href="/assets" className={cn(buttonVariants({ variant: "outline" }))}>
          목록으로
        </Link>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 text-sm font-medium">QR 정보</h2>
        {qr ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              코드: {qr.display_code} · 상태:{" "}
              {QR_STATUS_LABELS[qr.status] ?? qr.status} ·{" "}
              <Link
                href={`/q/${qr.token}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                QR 페이지
              </Link>
            </p>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                {qr.status === "assigned" ? (
                  <UnlinkQrButton assetId={(asset as Asset).id} />
                ) : null}
                {qr.status !== "retired" ? (
                  <RetireQrButton qrId={qr.id} status={qr.status} />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">QR 미연결</p>
        )}
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-sm font-medium">사진</h2>
        <AssetPhotosPanel
          assetId={(asset as Asset).id}
          photos={photos}
          signedUrls={signedUrls}
        />
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-sm font-medium">이관</h2>
        <AssetTransferForm
          asset={asset as Asset}
          suggestions={{
            locations: suggestions.locations,
            departments: suggestions.departments,
          }}
        />
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-sm font-medium">자산 수정</h2>
        <AssetEditForm asset={asset as Asset} suggestions={suggestions} />
      </div>

      {canViewHistory ? (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 text-sm font-medium">변경 이력</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">이력이 없습니다.</p>
          ) : (
            <ul className="space-y-3 text-sm" data-testid="asset-history">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="border-b border-foreground/5 pb-2 last:border-0"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{h.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {formatHistoryPayload(h.payload)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).slice(0, 80).sort((a, b) => a.localeCompare(b, "ko"));
}

function formatHistoryPayload(payload: Record<string, unknown>): string {
  const changes = payload?.changes as
    | Record<string, { from: unknown; to: unknown }>
    | undefined;
  if (changes && typeof changes === "object") {
    return Object.entries(changes)
      .map(
        ([k, v]) =>
          `${k}: ${stringifyVal(v.from)} → ${stringifyVal(v.to)}`
      )
      .join("\n");
  }
  try {
    return JSON.stringify(payload, null, 0);
  } catch {
    return String(payload);
  }
}

function stringifyVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(없음)";
  return String(v);
}
