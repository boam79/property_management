import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  profiles: { display_name: string | null; role: string } | null;
};

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, payload, created_at, profiles:actor_id(display_name, role)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[audit]", error.message);
  }

  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">감사 로그</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            최근 100건의 주요 동작(QR 등록·임포트·QR 연결 등)입니다.{" "}
            <strong className="font-medium text-foreground">
              공용 등록 계정은 개인을 식별할 수 없어
            </strong>{" "}
            행위자는 계정(표시명/역할) 단위까지만 기록됩니다.
          </p>
        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          대시보드
        </Link>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시각</TableHead>
              <TableHead>행위자</TableHead>
              <TableHead>동작</TableHead>
              <TableHead>대상</TableHead>
              <TableHead>상세</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  기록이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.profiles?.display_name ?? r.actor_id?.slice(0, 8) ?? "—"}
                    {r.profiles?.role ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({r.profiles.role})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="text-xs">
                    {r.entity_type ?? "—"}
                    {r.entity_id ? (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {r.entity_id.slice(0, 8)}…
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(r.payload ?? {})}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
