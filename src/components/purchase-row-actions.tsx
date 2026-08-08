"use client";

import { useActionState, useState } from "react";
import {
  deletePurchaseHistory,
  updatePurchaseHistory,
  type PurchaseActionState,
} from "@/app/(app)/admin/purchases/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PurchaseHistory } from "@/lib/types";

const initial: PurchaseActionState = { ok: false };

export function PurchaseRowActions({ row }: { row: PurchaseHistory }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(
    updatePurchaseHistory,
    initial
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePurchaseHistory,
    initial
  );

  if (editing) {
    return (
      <form action={updateAction} className="flex min-w-[16rem] flex-col gap-2">
        <input type="hidden" name="id" value={row.id} />
        <div className="space-y-1">
          <Label htmlFor={`item-${row.id}`}>품목</Label>
          <Input
            id={`item-${row.id}`}
            name="item_name"
            defaultValue={row.item_name}
            required
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`date-${row.id}`}>구매일자</Label>
          <Input
            id={`date-${row.id}`}
            name="purchase_date"
            type="date"
            defaultValue={row.purchase_date}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dept-${row.id}`}>사용부서</Label>
          <Input
            id={`dept-${row.id}`}
            name="department"
            defaultValue={row.department}
            required
            maxLength={100}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={updatePending}>
            저장
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            취소
          </Button>
        </div>
        {updateState.message ? (
          <p
            className={
              updateState.ok
                ? "text-xs text-emerald-700"
                : "text-xs text-destructive"
            }
          >
            {updateState.message}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
        >
          수정
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={row.id} />
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            disabled={deletePending}
            onClick={(e) => {
              if (!confirm("이 구매이력을 삭제할까요?")) {
                e.preventDefault();
              }
            }}
          >
            삭제
          </Button>
        </form>
      </div>
      {deleteState.message && !deleteState.ok ? (
        <p className="text-xs text-destructive">{deleteState.message}</p>
      ) : null}
    </div>
  );
}
