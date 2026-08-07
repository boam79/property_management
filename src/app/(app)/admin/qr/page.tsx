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

type StatusFilter = "all" | QrStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unused", label: "미사용" },
  { key: "assigned", label: "사용(연결됨)" },
  { key: "retired", label: "폐기" },
];

type BatchStatusCounts = {
  unused: number;
  assigned: number;
  retired: number;
};

function emptyCounts(): BatchStatusCounts {
  return { unused: 0, assigned: 0, retired: 0 };
}

function parseFilter(raw: string | undefined): StatusFilter {
  if (raw === "unused" || raw === "assigned" || raw === "retired") return raw;
  return "all";
}

export default async function AdminQrPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const statusFilter = parseFilter(params.status);

  const supabase = await createClient();

  const [
    { data: batches },
    unusedCountRes,
    assignedCountRes,
    retiredCountRes,
  ] = await Promise.all([
    supabase
      .from("qr_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("qr_codes")
      .select("id", { count: "exact", head: true })
      .eq("status", "unused"),
    supabase
      .from("qr_codes")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned"),
    supabase
      .from("qr_codes")
      .select("id", { count: "exact", head: true })
      .eq("status", "retired"),
  ]);

  const totals: BatchStatusCounts = {
    unused: unusedCountRes.count ?? 0,
    assigned: assignedCountRes.count ?? 0,
    retired: retiredCountRes.count ?? 0,
  };

  const batchList = (batches as QrBatch[] | null) ?? [];
  const batchIds = batchList.map((b) => b.id);

  let batchCounts = new Map<string, BatchStatusCounts>();
  if (batchIds.length) {
    const { data: batchCodeRows } = await supabase
      .from("qr_codes")
      .select("batch_id, status")
      .in("batch_id", batchIds);

    batchCounts = new Map();
    for (const id of batchIds) batchCounts.set(id, emptyCounts());
    for (const row of batchCodeRows ?? []) {
      const bid = row.batch_id as string | null;
      const st = row.status as QrStatus;
      if (!bid || !batchCounts.has(bid)) continue;
      const c = batchCounts.get(bid)!;
      if (st === "unused" || st === "assigned" || st === "retired") {
        c[st] += 1;
      }
    }
  }

  let unusedList: Partial<QrCode>[] = [];
  let assignedList: Partial<QrCode>[] = [];
  let retiredList: Partial<QrCode>[] = [];
  let codeList: Partial<QrCode>[] = [];

  if (statusFilter === "all") {
    const [unusedRes, assignedRes, retiredRes] = await Promise.all([
      supabase
        .from("qr_codes")
        .select(
          "id, token, display_code, status, asset_id, created_at, assigned_at"
        )
        .eq("status", "unused")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("qr_codes")
        .select(
          "id, token, display_code, status, asset_id, created_at, assigned_at"
        )
        .eq("status", "assigned")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("qr_codes")
        .select(
          "id, token, display_code, status, asset_id, created_at, assigned_at"
        )
        .eq("status", "retired")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    unusedList = (unusedRes.data as Partial<QrCode>[] | null) ?? [];
    assignedList = (assignedRes.data as Partial<QrCode>[] | null) ?? [];
    retiredList = (retiredRes.data as Partial<QrCode>[] | null) ?? [];
    codeList = [...unusedList, ...assignedList, ...retiredList];
  } else {
    const { data: codes } = await supabase
      .from("qr_codes")
      .select(
        "id, token, display_code, status, asset_id, created_at, assigned_at"
      )
      .eq("status", statusFilter)
      .order("created_at", { ascending: false })
      .limit(100);
    codeList = (codes as Partial<QrCode>[] | null) ?? [];
    if (statusFilter === "unused") unusedList = codeList;
    if (statusFilter === "assigned") assignedList = codeList;
    if (statusFilter === "retired") retiredList = codeList;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">빈 QR 생성</h1>
        <p className="text-sm text-muted-foreground">
          배치를 생성한 뒤 SVG·PNG·PDF로 다운로드하세요. 미사용·사용(연결)·폐기로
          분류해 확인할 수 있습니다.
        </p>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <QrBatchForm />
      </div>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="QR 상태 요약"
        data-testid="qr-status-summary"
      >
        <StatusSummaryCard
          href="/admin/qr?status=unused"
          label="미사용"
          count={totals.unused}
          active={statusFilter === "unused"}
          tone="unused"
        />
        <StatusSummaryCard
          href="/admin/qr?status=assigned"
          label="사용(연결됨)"
          count={totals.assigned}
          active={statusFilter === "assigned"}
          tone="assigned"
        />
        <StatusSummaryCard
          href="/admin/qr?status=retired"
          label="폐기"
          count={totals.retired}
          active={statusFilter === "retired"}
          tone="retired"
        />
      </section>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>배치 ID</TableHead>
              <TableHead>수량</TableHead>
              <TableHead>미사용</TableHead>
              <TableHead>사용</TableHead>
              <TableHead>폐기</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead>다운로드</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchList.length ? (
              batchList.map((b) => {
                const counts = batchCounts.get(b.id) ?? emptyCounts();
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">
                      {b.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{b.quantity}</TableCell>
                    <TableCell>{counts.unused}</TableCell>
                    <TableCell>{counts.assigned}</TableCell>
                    <TableCell>{counts.retired}</TableCell>
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
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
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
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">QR 목록 · 사용/미사용</h2>
            <p className="text-sm text-muted-foreground">
              연결 해제 시 미사용으로 돌아갑니다. 폐기는 되돌릴 수 없습니다.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-1"
            aria-label="QR 상태 필터"
            data-testid="qr-status-filter"
          >
            {FILTERS.map((f) => {
              const href =
                f.key === "all" ? "/admin/qr" : `/admin/qr?status=${f.key}`;
              const active = statusFilter === f.key;
              return (
                <Link
                  key={f.key}
                  href={href}
                  className={cn(
                    buttonVariants({
                      variant: active ? "default" : "outline",
                      size: "xs",
                    })
                  )}
                >
                  {f.label}
                  {f.key !== "all" ? (
                    <span className="ml-1 opacity-80">
                      ({totals[f.key as QrStatus]})
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {statusFilter === "all" ? (
          <div className="space-y-6" data-testid="qr-lifecycle-table">
            <QrStatusSection
              title="미사용"
              description="아직 자산에 연결되지 않은 QR"
              codes={unusedList}
              emptyMessage="미사용 QR이 없습니다."
              testId="qr-unused-table"
            />
            <QrStatusSection
              title="사용(연결됨)"
              description="자산에 연결된 QR"
              codes={assignedList}
              emptyMessage="사용 중인 QR이 없습니다."
              testId="qr-assigned-table"
            />
            <QrStatusSection
              title="폐기"
              description="더 이상 사용할 수 없는 QR"
              codes={retiredList}
              emptyMessage="폐기된 QR이 없습니다."
              testId="qr-retired-table"
            />
          </div>
        ) : (
          <QrStatusSection
            title={FILTERS.find((f) => f.key === statusFilter)?.label ?? "QR"}
            description={
              statusFilter === "unused"
                ? "아직 자산에 연결되지 않은 QR"
                : statusFilter === "assigned"
                  ? "자산에 연결된 QR"
                  : "더 이상 사용할 수 없는 QR"
            }
            codes={codeList}
            emptyMessage="해당 상태의 QR이 없습니다."
            testId="qr-lifecycle-table"
          />
        )}
      </div>
    </div>
  );
}

function StatusSummaryCard({
  href,
  label,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone: QrStatus;
}) {
  const toneClass =
    tone === "unused"
      ? "border-l-emerald-600"
      : tone === "assigned"
        ? "border-l-sky-600"
        : "border-l-zinc-500";

  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border-l-4 bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40",
        toneClass,
        active && "ring-2 ring-foreground/30"
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
    </Link>
  );
}

function QrStatusSection({
  title,
  description,
  codes,
  emptyMessage,
  testId,
}: {
  title: string;
  description: string;
  codes: Partial<QrCode>[];
  emptyMessage: string;
  testId: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">({codes.length})</span>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{description}</p>
      <div
        className="rounded-xl bg-card ring-1 ring-foreground/10"
        data-testid={testId}
      >
        <QrCodesTable codes={codes} emptyMessage={emptyMessage} />
      </div>
    </section>
  );
}

function QrCodesTable({
  codes,
  emptyMessage,
}: {
  codes: Partial<QrCode>[];
  emptyMessage: string;
}) {
  return (
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
        {codes.length ? (
          codes.map((c) => (
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
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
