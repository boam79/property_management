import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QrBatchForm } from "@/components/qr-batch-form";
import type { QrBatch } from "@/lib/types";
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

  const { data: batches } = await supabase
    .from("qr_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">빈 QR 생성</h1>
        <p className="text-sm text-muted-foreground">
          배치를 생성한 뒤 SVG·PNG·PDF로 다운로드하세요.
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
                  <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
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
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  아직 생성된 배치가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
