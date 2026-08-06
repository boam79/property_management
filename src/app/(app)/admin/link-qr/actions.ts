"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LinkQrState = {
  ok: boolean;
  message?: string;
};

export async function linkAssetToQr(
  _prev: LinkQrState,
  formData: FormData
): Promise<LinkQrState> {
  await requireAdmin();
  const assetId = String(formData.get("asset_id") ?? "");
  const qrId = String(formData.get("qr_id") ?? "");

  if (!assetId || !qrId) {
    return { ok: false, message: "자산과 QR을 선택하세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("link_asset_to_qr", {
    p_asset_id: assetId,
    p_qr_id: qrId,
  });

  if (error) {
    console.error("[linkAssetToQr]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false, message: result?.error ?? "연결 실패" };
  }

  revalidatePath("/admin/link-qr");
  revalidatePath("/assets");
  return { ok: true, message: "QR을 연결했습니다." };
}
