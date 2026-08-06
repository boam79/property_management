"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatus, AssetType } from "@/lib/types";

export type UpdateAssetState = {
  ok: boolean;
  message?: string;
};

export async function updateAsset(
  _prev: UpdateAssetState,
  formData: FormData
): Promise<UpdateAssetState> {
  const { userId } = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "자산 ID가 없습니다." };

  const payload = {
    asset_no: String(formData.get("asset_no") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    asset_type: String(formData.get("asset_type") ?? "") as AssetType,
    category: String(formData.get("category") ?? "").trim(),
    status: String(formData.get("status") ?? "") as AssetStatus,
    serial_no: emptyToNull(formData.get("serial_no")),
    manufacturer: emptyToNull(formData.get("manufacturer")),
    model_name: emptyToNull(formData.get("model_name")),
    location: emptyToNull(formData.get("location")),
    department: emptyToNull(formData.get("department")),
    assignee_name: emptyToNull(formData.get("assignee_name")),
    notes: emptyToNull(formData.get("notes")),
    purchase_date: emptyToNull(formData.get("purchase_date")),
    purchase_price: parsePrice(formData.get("purchase_price")),
    updated_by: userId,
  };

  if (!payload.asset_no || !payload.name || !payload.category) {
    return { ok: false, message: "필수 항목을 입력하세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assets").update(payload).eq("id", id);

  if (error) {
    console.error("[updateAsset]", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { ok: true, message: "저장되었습니다." };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function parsePrice(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}
