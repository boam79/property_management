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

const ASSIGN_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  INVALID_ASSET_TYPE: "자산구분이 올바르지 않습니다.",
  INVALID_STATUS: "자산 상태가 올바르지 않습니다.",
  QR_NOT_FOUND: "QR을 찾을 수 없습니다.",
  QR_RETIRED: "폐기된 QR입니다. 등록할 수 없습니다.",
  QR_ALREADY_ASSIGNED: "이미 등록된 QR입니다. 기존 자산으로 이동합니다.",
  DUPLICATE_VALUE: "이미 사용 중인 자산번호 또는 시리얼번호입니다. 다른 값으로 다시 시도하세요.",
};

function messageForAssignError(code: string | undefined, detail?: string): string {
  if (!code) return "등록에 실패했습니다.";
  if (code === "DUPLICATE_VALUE") {
    if (detail?.includes("serial")) {
      return "이미 사용 중인 시리얼번호입니다. 다른 값으로 다시 시도하세요.";
    }
    if (detail?.includes("asset_no")) {
      return "이미 사용 중인 자산번호입니다. 다른 값으로 다시 시도하세요.";
    }
    return ASSIGN_ERROR_MESSAGES.DUPLICATE_VALUE;
  }
  return ASSIGN_ERROR_MESSAGES[code] ?? "등록에 실패했습니다. 잠시 후 다시 시도하세요.";
}

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
    return {
      ok: false,
      message: "등록 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
    };
  }

  const result = data as AssignQrResult;
  if (!result?.ok) {
    if (result?.error === "QR_ALREADY_ASSIGNED") {
      return {
        ok: false,
        message: messageForAssignError(result.error),
        existingAssetId: result.existing_asset_id,
      };
    }
    return {
      ok: false,
      message: messageForAssignError(result?.error, result?.detail),
    };
  }

  redirect(`/assets/${result.asset_id}`);
}

function empty(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}
