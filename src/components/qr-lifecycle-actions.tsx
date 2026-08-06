"use client";

import { useActionState } from "react";
import {
  retireQrCode,
  unlinkAssetFromQr,
  type QrLifecycleState,
} from "@/app/(app)/admin/qr/lifecycle-actions";
import { Button } from "@/components/ui/button";
import { QR_STATUS_LABELS } from "@/lib/constants";
import type { QrStatus } from "@/lib/types";

const initial: QrLifecycleState = { ok: false };

export function UnlinkQrButton({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(unlinkAssetFromQr, initial);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="asset_id" value={assetId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        data-testid="unlink-qr"
      >
        {pending ? "해제 중…" : "QR 연결 해제"}
      </Button>
      {state.message ? (
        <span
          className={`text-xs ${state.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function RetireQrButton({
  qrId,
  status,
}: {
  qrId: string;
  status: QrStatus;
}) {
  const [state, action, pending] = useActionState(retireQrCode, initial);
  if (status === "retired") {
    return (
      <span className="text-xs text-muted-foreground">
        {QR_STATUS_LABELS.retired}
      </span>
    );
  }
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="qr_id" value={qrId} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        disabled={pending}
        data-testid="retire-qr"
      >
        {pending ? "폐기 중…" : "QR 폐기"}
      </Button>
      {state.message ? (
        <span
          className={`text-xs ${state.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
