"use client";

import { useActionState } from "react";
import {
  createQrBatch,
  type CreateQrBatchState,
} from "@/app/(app)/admin/qr/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initial: CreateQrBatchState = { ok: false };

export function QrBatchForm() {
  const [state, action, pending] = useActionState(createQrBatch, initial);

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="quantity">생성 수량</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={500}
            defaultValue={10}
            required
            className="h-8 w-28"
          />
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "생성 중…" : "배치 생성"}
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

      {state.ok && state.batchId ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["svg", "SVG"],
              ["png", "PNG"],
              ["pdf-a4", "PDF (A4)"],
              ["pdf-label", "PDF (라벨)"],
            ] as const
          ).map(([format, label]) => (
            <a
              key={format}
              href={`/api/admin/qr/${state.batchId}/export?format=${format}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {label} 다운로드
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
