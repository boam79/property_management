"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssignQrResult, AssetStatus, AssetType } from "@/lib/types";

export type RegisterState = {
  ok: boolean;
  message?: string;
  existingAssetId?: string;
};

export async function registerAssetOnQr(
  token: string,
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  await requireAuth(`/q/${token}`);

  const payload = {
    p_token: token,
    p_asset_no: String(formData.get("asset_no") ?? "").trim(),
    p_name: String(formData.get("name") ?? "").trim(),
    p_asset_type: String(formData.get("asset_type") ?? "") as AssetType,
    p_category: String(formData.get("category") ?? "").trim(),
    p_status: String(formData.get("status") ?? "IN_USE") as AssetStatus,
    p_serial_no: empty(formData.get("serial_no")),
    p_manufacturer: empty(formData.get("manufacturer")),
    p_model_name: empty(formData.get("model_name")),
    p_location: empty(formData.get("location")),
    p_department: empty(formData.get("department")),
    p_assignee_name: empty(formData.get("assignee_name")),
    p_notes: empty(formData.get("notes")),
    p_purchase_date: empty(formData.get("purchase_date")),
    p_purchase_price: empty(formData.get("purchase_price")),
  };

  if (!payload.p_asset_no || !payload.p_name || !payload.p_category) {
    return { ok: false, message: "필수 항목을 입력하세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_qr_and_create_asset", {
    ...payload,
    p_purchase_price: payload.p_purchase_price
      ? Number(payload.p_purchase_price)
      : null,
  });

  if (error) {
    console.error("[registerAssetOnQr]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as AssignQrResult;
  if (!result?.ok) {
    if (result?.error === "QR_ALREADY_ASSIGNED") {
      return {
        ok: false,
        message: "이미 등록된 QR입니다. 기존 자산으로 이동합니다.",
        existingAssetId: result.existing_asset_id,
      };
    }
    return {
      ok: false,
      message: result?.error ?? "등록에 실패했습니다.",
    };
  }

  redirect(`/assets/${result.asset_id}`);
}

function empty(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}
