"use client";

import { useActionState } from "react";
import {
  updateAsset,
  type UpdateAssetState,
} from "@/app/(app)/assets/actions";
import type { Asset } from "@/lib/types";
import { ASSET_STATUSES, ASSET_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: UpdateAssetState = { ok: false };

export function AssetEditForm({
  asset,
  suggestions,
}: {
  asset: Asset;
  suggestions?: {
    categories: string[];
    locations: string[];
    departments: string[];
  };
}) {
  const [state, action, pending] = useActionState(updateAsset, initial);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={asset.id} />

      <Field label="자산번호" name="asset_no" defaultValue={asset.asset_no} required />
      <Field label="자산명" name="name" defaultValue={asset.name} required />

      <div className="space-y-1">
        <Label htmlFor="asset_type">자산구분</Label>
        <select
          id="asset_type"
          name="asset_type"
          defaultValue={asset.asset_type}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          required
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <Field
        label="카테고리"
        name="category"
        defaultValue={asset.category}
        required
        listId="suggest-category"
      />

      <div className="space-y-1">
        <Label htmlFor="status">상태</Label>
        <select
          id="status"
          name="status"
          defaultValue={asset.status}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          required
        >
          {ASSET_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <Field label="시리얼번호" name="serial_no" defaultValue={asset.serial_no ?? ""} />
      <Field label="제조사" name="manufacturer" defaultValue={asset.manufacturer ?? ""} />
      <Field label="모델명" name="model_name" defaultValue={asset.model_name ?? ""} />
      <Field
        label="위치"
        name="location"
        defaultValue={asset.location ?? ""}
        listId="suggest-location"
      />
      <Field
        label="사용부서"
        name="department"
        defaultValue={asset.department ?? ""}
        listId="suggest-department"
      />
      <Field
        label="사용자/담당자"
        name="assignee_name"
        defaultValue={asset.assignee_name ?? ""}
      />
      <Field
        label="구매일"
        name="purchase_date"
        type="date"
        defaultValue={asset.purchase_date ?? ""}
      />
      <Field
        label="구매금액"
        name="purchase_price"
        type="number"
        defaultValue={asset.purchase_price?.toString() ?? ""}
      />

      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="notes">비고 (수리·폐기 시 필수)</Label>
        <Textarea id="notes" name="notes" defaultValue={asset.notes ?? ""} rows={3} />
      </div>

      {state.message ? (
        <p
          className={`sm:col-span-2 text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>

      <datalist id="suggest-category">
        {(suggestions?.categories ?? []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="suggest-location">
        {(suggestions?.locations ?? []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="suggest-department">
        {(suggestions?.departments ?? []).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  listId,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
  listId?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        list={listId}
      />
    </div>
  );
}
