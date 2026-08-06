"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  ASSET_PHOTO_MAX_BYTES,
  ASSET_PHOTO_MAX_PER_ASSET,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type PhotoActionState = {
  ok: boolean;
  message?: string;
};

export async function uploadAssetPhoto(
  _prev: PhotoActionState,
  formData: FormData
): Promise<PhotoActionState> {
  const { userId } = await requireAuth();
  const assetId = String(formData.get("asset_id") ?? "");
  const file = formData.get("file");

  if (!assetId) return { ok: false, message: "자산 ID가 없습니다." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "이미지 파일을 선택하세요." };
  }
  if (file.size > ASSET_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: `파일은 ${ASSET_PHOTO_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`,
    };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return { ok: false, message: "JPEG/PNG/WebP/GIF만 허용됩니다." };
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("asset_photos")
    .select("*", { count: "exact", head: true })
    .eq("asset_id", assetId);

  if ((count ?? 0) >= ASSET_PHOTO_MAX_PER_ASSET) {
    return {
      ok: false,
      message: `사진은 자산당 최대 ${ASSET_PHOTO_MAX_PER_ASSET}장입니다.`,
    };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `${userId}/${assetId}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("asset-photos")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[uploadAssetPhoto]", uploadError.message);
    return { ok: false, message: uploadError.message };
  }

  const { error: insertError } = await supabase.from("asset_photos").insert({
    asset_id: assetId,
    storage_path: path,
    file_name: file.name,
    content_type: file.type,
    created_by: userId,
  });

  if (insertError) {
    console.error("[uploadAssetPhoto insert]", insertError.message);
    await supabase.storage.from("asset-photos").remove([path]);
    return { ok: false, message: insertError.message };
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "asset.photo_upload",
    entity_type: "asset",
    entity_id: assetId,
    payload: { path, file_name: file.name },
  });

  revalidatePath(`/assets/${assetId}`);
  return { ok: true, message: "사진을 업로드했습니다." };
}

export async function deleteAssetPhoto(
  _prev: PhotoActionState,
  formData: FormData
): Promise<PhotoActionState> {
  const { userId, profile } = await requireAuth();
  const photoId = String(formData.get("photo_id") ?? "");
  const assetId = String(formData.get("asset_id") ?? "");
  if (!photoId || !assetId) {
    return { ok: false, message: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { data: photo, error } = await supabase
    .from("asset_photos")
    .select("*")
    .eq("id", photoId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (error || !photo) {
    return { ok: false, message: "사진을 찾을 수 없습니다." };
  }

  if (
    profile.role !== "ADMIN" &&
    photo.created_by !== userId
  ) {
    return { ok: false, message: "삭제 권한이 없습니다." };
  }

  const { error: delObj } = await supabase.storage
    .from("asset-photos")
    .remove([photo.storage_path as string]);
  if (delObj) {
    console.error("[deleteAssetPhoto storage]", delObj.message);
  }

  const { error: delRow } = await supabase
    .from("asset_photos")
    .delete()
    .eq("id", photoId);

  if (delRow) {
    console.error("[deleteAssetPhoto]", delRow.message);
    return { ok: false, message: delRow.message };
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "asset.photo_delete",
    entity_type: "asset",
    entity_id: assetId,
    payload: { photo_id: photoId, path: photo.storage_path },
  });

  revalidatePath(`/assets/${assetId}`);
  return { ok: true, message: "사진을 삭제했습니다." };
}
