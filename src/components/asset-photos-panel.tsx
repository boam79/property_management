"use client";

import { useActionState } from "react";
import {
  deleteAssetPhoto,
  uploadAssetPhoto,
  type PhotoActionState,
} from "@/app/(app)/assets/photo-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AssetPhoto } from "@/lib/types";

const initial: PhotoActionState = { ok: false };

export function AssetPhotosPanel({
  assetId,
  photos,
  signedUrls,
}: {
  assetId: string;
  photos: AssetPhoto[];
  signedUrls: Record<string, string>;
}) {
  const [upState, upAction, upPending] = useActionState(uploadAssetPhoto, initial);
  const [delState, delAction, delPending] = useActionState(
    deleteAssetPhoto,
    initial
  );

  return (
    <div className="space-y-4">
      <form action={upAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="asset_id" value={assetId} />
        <div className="space-y-1">
          <Label htmlFor="photo-file">사진 추가</Label>
          <input
            id="photo-file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            required
            className="block w-full max-w-xs text-sm"
            data-testid="photo-file"
          />
        </div>
        <Button type="submit" size="sm" disabled={upPending}>
          {upPending ? "업로드 중…" : "업로드"}
        </Button>
      </form>
      {upState.message ? (
        <p
          className={`text-sm ${upState.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {upState.message}
        </p>
      ) : null}
      {delState.message ? (
        <p
          className={`text-sm ${delState.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {delState.message}
        </p>
      ) : null}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 사진이 없습니다.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-lg ring-1 ring-foreground/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrls[p.id] ?? ""}
                alt={p.file_name ?? "자산 사진"}
                className="aspect-video w-full object-cover bg-muted"
              />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-xs text-muted-foreground">
                  {p.file_name || p.id.slice(0, 8)}
                </span>
                <form action={delAction}>
                  <input type="hidden" name="photo_id" value={p.id} />
                  <input type="hidden" name="asset_id" value={assetId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="xs"
                    disabled={delPending}
                  >
                    삭제
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
