"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssignQrResult, AssetStatus, AssetType } from "@/lib/types";

export type ManualRegisterState = {
  ok: boolean;
  message?: string;
};

const ASSIGN_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  INVALID_ASSET_TYPE: "자산구분이 올바르지 않습니다.",
  INVALID_STATUS: "자산 상태가 올바르지 않습니다.",
  QR_NOT_FOUND: "QR을 찾을 수 없습니다.",
  QR_RETIRED: "폐기된 QR입니다.",
  QR_ALREADY_ASSIGNED: "QR 배정에 실패했습니다. 다시 시도하세요.",
  DUPLICATE_VALUE: "이미 사용 중인 자산번호 또는 시리얼번호입니다.",
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

function empty(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

/** 자산 수동 등록 + QR 1개 신규 생성·배정 */
export async function createAssetWithNewQr(
  _prev: ManualRegisterState,
  formData: FormData
): Promise<ManualRegisterState> {
  const { userId } = await requireAdmin();

  const assetNo = String(formData.get("asset_no") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const assetType = String(formData.get("asset_type") ?? "") as AssetType;
  const status = String(formData.get("status") ?? "IN_USE") as AssetStatus;

  if (!assetNo || !name || !category) {
    return { ok: false, message: "필수 항목(자산번호·자산명·카테고리)을 입력하세요." };
  }

  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("qr_batches")
    .insert({
      quantity: 1,
      label_format: "manual-register",
      created_by: userId,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    console.error("[createAssetWithNewQr] batch", batchError?.message);
    return { ok: false, message: "QR 생성에 실패했습니다." };
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const displayCode = `QR-${stamp}-${batch.id.slice(0, 6)}-0001`;

  const { data: qr, error: qrError } = await supabase
    .from("qr_codes")
    .insert({
      display_code: displayCode,
      status: "unused",
      batch_id: batch.id,
      created_by: userId,
    })
    .select("id, token, display_code")
    .single();

  if (qrError || !qr) {
    console.error("[createAssetWithNewQr] qr", qrError?.message);
    await supabase.from("qr_batches").delete().eq("id", batch.id);
    return { ok: false, message: qrError?.message ?? "QR 코드 생성에 실패했습니다." };
  }

  const { data, error } = await supabase.rpc("assign_qr_and_create_asset", {
    p_token: qr.token,
    p_asset_no: assetNo,
    p_name: name,
    p_asset_type: assetType,
    p_category: category,
    p_status: status,
    p_serial_no: empty(formData.get("serial_no")),
    p_manufacturer: empty(formData.get("manufacturer")),
    p_model_name: empty(formData.get("model_name")),
    p_location: empty(formData.get("location")),
    p_department: empty(formData.get("department")),
    p_assignee_name: empty(formData.get("assignee_name")),
    p_notes: empty(formData.get("notes")),
    p_purchase_date: empty(formData.get("purchase_date")),
    p_purchase_price: (() => {
      const raw = empty(formData.get("purchase_price"));
      return raw ? Number(raw) : null;
    })(),
  });

  if (error) {
    console.error("[createAssetWithNewQr] assign", error.message);
    return {
      ok: false,
      message: "자산 등록 중 오류가 발생했습니다. (생성된 QR은 미사용으로 남습니다)",
    };
  }

  const result = data as AssignQrResult;
  if (!result?.ok) {
    return {
      ok: false,
      message: messageForAssignError(result?.error, result?.detail),
    };
  }

  revalidatePath("/assets");
  revalidatePath("/admin/qr");
  revalidatePath("/admin/register");
  revalidatePath("/admin/audit");
  redirect(`/assets/${result.asset_id}`);
}
