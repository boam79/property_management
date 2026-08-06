"use client";

import { useActionState } from "react";
import {
  commitImport,
  validateImport,
  type ImportPreviewState,
} from "@/app/(app)/admin/import/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const initial: ImportPreviewState = { ok: false };

export function ImportWizard() {
  const [validateState, validateAction, validating] = useActionState(
    validateImport,
    initial
  );
  const [commitState, commitAction, committing] = useActionState(
    commitImport,
    initial
  );

  const state = commitState.message ? commitState : validateState;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/admin/import/template"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          템플릿 다운로드
        </a>
      </div>

      <form
        action={validateAction}
        className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        encType="multipart/form-data"
      >
        <div className="space-y-1">
          <Label htmlFor="file">엑셀 업로드 (.xlsx)</Label>
          <Input id="file" name="file" type="file" accept=".xlsx" required />
        </div>
        <Button type="submit" disabled={validating}>
          {validating ? "검증 중…" : "업로드·검증"}
        </Button>
      </form>

      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      {validateState.errorFileBase64 ? (
        <a
          href={`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${validateState.errorFileBase64}`}
          download="import-errors.xlsx"
          className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
        >
          오류 파일 다운로드
        </a>
      ) : null}

      {validateState.preview && validateState.preview.length > 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-2 text-sm font-medium">
            미리보기 (최대 50행)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>자산번호</TableHead>
                <TableHead>자산명</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>위치</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validateState.preview.map((r) => (
                <TableRow key={r.asset_no}>
                  <TableCell>{r.asset_no}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.asset_type}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.location || "미지정"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {validateState.ok && validateState.payloadBase64 ? (
        <form action={commitAction} className="space-y-2">
          <input
            type="hidden"
            name="payloadBase64"
            value={validateState.payloadBase64}
          />
          <Button type="submit" disabled={committing}>
            {committing ? "반영 중…" : "전체 반영"}
          </Button>
        </form>
      ) : null}

      {validateState.errors && validateState.errors.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-destructive">
          {validateState.errors.slice(0, 20).map((e, i) => (
            <li key={`${e.rowNumber}-${i}`}>
              행 {e.rowNumber}: {e.message}
              {e.value ? ` (${e.value})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
