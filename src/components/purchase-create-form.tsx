"use client";

import { useActionState } from "react";
import {
  createPurchaseHistory,
  type PurchaseActionState,
} from "@/app/(app)/admin/purchases/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: PurchaseActionState = { ok: false };

export function PurchaseCreateForm() {
  const [state, action, pending] = useActionState(
    createPurchaseHistory,
    initial
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div className="space-y-1 sm:col-span-1">
        <Label htmlFor="item_name">품목</Label>
        <Input id="item_name" name="item_name" required maxLength={200} />
      </div>
      <div className="space-y-1 sm:col-span-1">
        <Label htmlFor="purchase_date">구매일자</Label>
        <Input id="purchase_date" name="purchase_date" type="date" required />
      </div>
      <div className="space-y-1 sm:col-span-1">
        <Label htmlFor="department">사용부서</Label>
        <Input id="department" name="department" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "등록 중…" : "등록"}
        </Button>
        {state.message ? (
          <p
            className={
              state.ok
                ? "text-xs text-emerald-700"
                : "text-xs text-destructive"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
