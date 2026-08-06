import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QrBatchForm } from "@/components/qr-batch-form";
import {
  RetireQrButton,
  UnlinkQrButton,
} from "@/components/qr-lifecycle-actions";
import { QR_STATUS_LABELS } from "@/lib/constants";
import type { QrBatch, QrCode, QrStatus } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminQrPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: batches }, { data: codes }] = await Promise.all([
    supabase
      .from("qr_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("qr_codes")
      .select("id, token, display_code, status, asset_id, created_at, assigned_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">빈 QR 생성</h1>
        <p className="text-sm text-muted-foreground">
          배치를 생성한 뒤 SVG·PNG·PDF로 다운로드하세요. 아래에서 연결 해제·폐기도
          가능합니다.
        </p>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <QrBatchForm />
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>배치 ID</TableHead>
              <TableHead>수량</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead>다운로드</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(batches as QrBatch[] | null)?.length ? (
              (batches as QrBatch[]).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{b.quantity}</TableCell>
                  <TableCell>
                    {new Date(b.created_at).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(["svg", "png", "pdf-a4", "pdf-label"] as const).map(
                        (format) => (
                          <a
                            key={format}
                            href={`/api/admin/qr/${b.id}/export?format=${format}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "xs" })
                            )}
                          >
                            {format}
                          </a>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  아직 생성된 배치가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">최근 QR · 수명주기</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          연결 해제 시 QR은 미사용으로 돌아갑니다. 폐기는 되돌릴 수 없습니다.
        </p>
        <div
          className="rounded-xl bg-card ring-1 ring-foreground/10"
          data-testid="qr-lifecycle-table"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>표시코드</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>자산</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(codes as Partial<QrCode>[] | null)?.length ? (
                (codes as Partial<QrCode>[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/q/${c.token}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.display_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {QR_STATUS_LABELS[(c.status as QrStatus) ?? "unused"] ??
                        c.status}
                    </TableCell>
                    <TableCell>
                      {c.asset_id ? (
                        <Link
                          href={`/assets/${c.asset_id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {c.asset_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString("ko-KR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {c.status === "assigned" && c.asset_id ? (
                          <UnlinkQrButton assetId={c.asset_id} />
                        ) : null}
                        {c.id && c.status && c.status !== "retired" ? (
                          <RetireQrButton
                            qrId={c.id}
                            status={c.status as QrStatus}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    QR이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
