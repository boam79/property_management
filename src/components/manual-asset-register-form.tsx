"use client";

import { useActionState } from "react";
import {
  createAssetWithNewQr,
  type ManualRegisterState,
} from "@/app/(app)/admin/register/actions";
import { ASSET_STATUSES, ASSET_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ManualRegisterState = { ok: false };

export function ManualAssetRegisterForm() {
  const [state, action, pending] = useActionState(createAssetWithNewQr, initial);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <p className="sm:col-span-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        등록하면 <strong className="text-foreground">QR 1개</strong>를 새로 만들고 이
        자산에 바로 연결합니다. 인쇄는 QR생성 메뉴의 해당 배치에서 할 수 있습니다.
      </p>

      <Field label="자산번호" name="asset_no" required />
      <Field label="자산명" name="name" required />

      <div className="space-y-1">
        <Label htmlFor="asset_type">자산구분</Label>
        <select
          id="asset_type"
          name="asset_type"
          defaultValue="GENERAL"
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

      <Field label="카테고리" name="category" required />

      <div className="space-y-1">
        <Label htmlFor="status">상태</Label>
        <select
          id="status"
          name="status"
          defaultValue="IN_USE"
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

      <Field label="시리얼번호" name="serial_no" />
      <Field label="제조사" name="manufacturer" />
      <Field label="모델명" name="model_name" />
      <Field label="위치" name="location" />
      <Field label="사용부서" name="department" />
      <Field label="사용자/담당자" name="assignee_name" />
      <Field label="구매일" name="purchase_date" type="date" />
      <Field label="구매금액" name="purchase_price" type="number" />

      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="notes">비고</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      {state.message ? (
        <p className="sm:col-span-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "등록·QR 배정 중…" : "등록하고 QR 배정"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
