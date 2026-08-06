import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoleChangeForm } from "@/components/role-change-form";
import type { Profile } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminUsersPage() {
  const current = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[admin users]", error.message);
  }

  const profiles = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">사용자·역할</h1>
        <p className="text-sm text-muted-foreground">
          관리자만 다른 사용자의 역할을 변경할 수 있습니다. 본인 역할·마지막
          ADMIN 해제는 불가합니다.
        </p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  사용자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.display_name || p.id.slice(0, 8)}
                    {p.id === current.userId ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (나)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{p.role}</TableCell>
                  <TableCell>
                    {new Date(p.created_at).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <RoleChangeForm
                      userId={p.id}
                      currentRole={p.role}
                      disabled={p.id === current.userId}
                    />
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
