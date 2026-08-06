"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Asset, AssetStatus, AssetType } from "@/lib/types";

export type UpdateAssetState = {
  ok: boolean;
  message?: string;
};

const TRACKED_KEYS = [
  "asset_no",
  "name",
  "asset_type",
  "category",
  "status",
  "serial_no",
  "manufacturer",
  "model_name",
  "location",
  "department",
  "assignee_name",
  "notes",
  "purchase_date",
  "purchase_price",
] as const;

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

  // 수리/폐기 전환 시 비고 권장 → 필수
  if (
    (payload.status === "REPAIR" || payload.status === "DISPOSED") &&
    !payload.notes
  ) {
    return {
      ok: false,
      message: "수리 중·폐기 상태에서는 비고(사유)를 입력하세요.",
    };
  }

  const supabase = await createClient();

  const { data: before, error: beforeErr } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (beforeErr || !before) {
    console.error("[updateAsset before]", beforeErr?.message);
    return { ok: false, message: "자산을 찾을 수 없습니다." };
  }

  const prev = before as Asset;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of TRACKED_KEYS) {
    const fromVal = normalizeCompare(prev[key]);
    const toVal = normalizeCompare(payload[key]);
    if (fromVal !== toVal) {
      changes[key] = { from: prev[key], to: payload[key] };
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: true, message: "변경 사항이 없습니다." };
  }

  const { error } = await supabase.from("assets").update(payload).eq("id", id);

  if (error) {
    console.error("[updateAsset]", error.message);
    return { ok: false, message: error.message };
  }

  const { error: auditErr } = await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "asset.update",
    entity_type: "asset",
    entity_id: id,
    payload: { changes },
  });
  if (auditErr) {
    console.error("[updateAsset audit]", auditErr.message);
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/admin/audit");
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

function normalizeCompare(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
