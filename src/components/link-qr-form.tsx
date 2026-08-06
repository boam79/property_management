"use client";

import { useActionState } from "react";
import {
  linkAssetToQr,
  type LinkQrState,
} from "@/app/(app)/admin/link-qr/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: LinkQrState = { ok: false };

type Option = { id: string; label: string };

export function LinkQrForm({
  assets,
  qrs,
}: {
  assets: Option[];
  qrs: Option[];
}) {
  const [state, action, pending] = useActionState(linkAssetToQr, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="asset_id">QR 미연결 자산</Label>
        <select
          id="asset_id"
          name="asset_id"
          required
          className="h-8 w-full max-w-lg rounded-lg border border-input bg-transparent px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            선택
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="qr_id">미사용 QR</Label>
        <select
          id="qr_id"
          name="qr_id"
          required
          className="h-8 w-full max-w-lg rounded-lg border border-input bg-transparent px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            선택
          </option>
          {qrs.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || assets.length === 0 || qrs.length === 0}>
        {pending ? "연결 중…" : "연결"}
      </Button>
    </form>
  );
}
