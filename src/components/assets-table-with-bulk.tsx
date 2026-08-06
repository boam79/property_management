"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  bulkUpdateAssets,
  type BulkUpdateState,
} from "@/app/(app)/assets/workflow-actions";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUSES,
  ASSET_TYPE_LABELS,
} from "@/lib/constants";
import type { Asset } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

const initial: BulkUpdateState = { ok: false };

export function AssetsTableWithBulk({
  assets,
  enableBulk,
}: {
  assets: Asset[];
  enableBulk: boolean;
}) {
  const ids = useMemo(() => assets.map((a) => a.id), [assets]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(bulkUpdateAssets, initial);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids)
    );
  }

  return (
    <div className="space-y-4">
      {enableBulk ? (
        <div
          className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          data-testid="bulk-update-bar"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              일괄 변경{" "}
              <span className="text-muted-foreground">
                ({selected.size}건 선택)
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={ids.length === 0}
            >
              {selected.size === ids.length && ids.length > 0
                ? "선택 해제"
                : "전체 선택"}
            </Button>
          </div>
          <form
            action={action}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <input
              type="hidden"
              name="asset_ids"
              value={Array.from(selected).join(",")}
            />
            <div className="space-y-1">
              <Label htmlFor="bulk-status">상태</Label>
              <select
                id="bulk-status"
                name="status"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                defaultValue=""
              >
                <option value="">변경 안 함</option>
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-location">위치</Label>
              <Input
                id="bulk-location"
                name="location"
                placeholder="변경 시 입력"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-department">부서</Label>
              <Input
                id="bulk-department"
                name="department"
                placeholder="변경 시 입력"
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="bulk-reason">사유 (수리·폐기 시 필수)</Label>
              <Input id="bulk-reason" name="reason" placeholder="사유" />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
              <Button
                type="submit"
                size="sm"
                disabled={pending || selected.size === 0}
              >
                {pending ? "적용 중…" : "선택 항목 적용"}
              </Button>
              {state.message ? (
                <p
                  className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
                >
                  {state.message}
                </p>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              {enableBulk ? <TableHead className="w-10">선택</TableHead> : null}
              <TableHead>자산번호</TableHead>
              <TableHead>자산명</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>위치</TableHead>
              <TableHead>QR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={enableBulk ? 7 : 6}
                  className="text-center text-muted-foreground"
                >
                  등록된 자산이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a) => (
                <TableRow key={a.id}>
                  {enableBulk ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        aria-label={`${a.asset_no} 선택`}
                        data-testid={`bulk-check-${a.id}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Link
                      href={`/assets/${a.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {a.asset_no}
                    </Link>
                  </TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{ASSET_TYPE_LABELS[a.asset_type]}</TableCell>
                  <TableCell>{ASSET_STATUS_LABELS[a.status]}</TableCell>
                  <TableCell>{a.location || "미지정"}</TableCell>
                  <TableCell>{a.qr_code_id ? "연결" : "미연결"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
