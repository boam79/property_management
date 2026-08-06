"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type QrLifecycleState = {
  ok: boolean;
  message?: string;
};

export async function unlinkAssetFromQr(
  _prev: QrLifecycleState,
  formData: FormData
): Promise<QrLifecycleState> {
  await requireAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  if (!assetId) return { ok: false, message: "자산 ID가 없습니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlink_asset_from_qr", {
    p_asset_id: assetId,
  });

  if (error) {
    console.error("[unlinkAssetFromQr]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false, message: mapQrError(result?.error) };
  }

  revalidatePath("/admin/qr");
  revalidatePath("/admin/link-qr");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { ok: true, message: "QR 연결을 해제했습니다. QR은 미사용으로 돌아갑니다." };
}

export async function retireQrCode(
  _prev: QrLifecycleState,
  formData: FormData
): Promise<QrLifecycleState> {
  await requireAdmin();
  const qrId = String(formData.get("qr_id") ?? "");
  if (!qrId) return { ok: false, message: "QR ID가 없습니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retire_qr_code", {
    p_qr_id: qrId,
  });

  if (error) {
    console.error("[retireQrCode]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    asset_id?: string | null;
  };
  if (!result?.ok) {
    return { ok: false, message: mapQrError(result?.error) };
  }

  revalidatePath("/admin/qr");
  revalidatePath("/admin/link-qr");
  revalidatePath("/assets");
  if (result.asset_id) {
    revalidatePath(`/assets/${result.asset_id}`);
  }
  return { ok: true, message: "QR을 폐기했습니다." };
}

function mapQrError(code?: string): string {
  switch (code) {
    case "FORBIDDEN":
      return "권한이 없습니다.";
    case "ASSET_NOT_FOUND":
      return "자산을 찾을 수 없습니다.";
    case "ASSET_NOT_LINKED":
      return "연결된 QR이 없습니다.";
    case "QR_NOT_FOUND":
      return "QR을 찾을 수 없습니다.";
    case "QR_NOT_ASSIGNED":
      return "연결된(assigned) QR이 아닙니다.";
    case "QR_ALREADY_RETIRED":
      return "이미 폐기된 QR입니다.";
    default:
      return code ?? "처리 실패";
  }
}
