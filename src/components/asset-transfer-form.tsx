"use client";

import { useActionState } from "react";
import {
  transferAsset,
  type TransferState,
} from "@/app/(app)/assets/workflow-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Asset } from "@/lib/types";

const initial: TransferState = { ok: false };

export function AssetTransferForm({
  asset,
  suggestions,
}: {
  asset: Asset;
  suggestions?: { locations: string[]; departments: string[] };
}) {
  const [state, action, pending] = useActionState(transferAsset, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" data-testid="transfer-form">
      <input type="hidden" name="id" value={asset.id} />
      <div className="space-y-1">
        <Label htmlFor="transfer-assignee">새 담당자</Label>
        <Input
          id="transfer-assignee"
          name="assignee_name"
          placeholder={asset.assignee_name ?? "담당자"}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="transfer-department">새 부서</Label>
        <Input
          id="transfer-department"
          name="department"
          list="transfer-suggest-dept"
          placeholder={asset.department ?? "부서"}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="transfer-location">새 위치</Label>
        <Input
          id="transfer-location"
          name="location"
          list="transfer-suggest-loc"
          placeholder={asset.location ?? "위치"}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="transfer-reason">이관 사유 (필수)</Label>
        <Textarea id="transfer-reason" name="reason" rows={2} required />
      </div>
      {state.message ? (
        <p
          className={`sm:col-span-2 text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "이관 중…" : "이관 적용"}
        </Button>
      </div>
      <datalist id="transfer-suggest-dept">
        {(suggestions?.departments ?? []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="transfer-suggest-loc">
        {(suggestions?.locations ?? []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </form>
  );
}
