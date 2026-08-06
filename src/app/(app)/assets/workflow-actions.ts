"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssetStatus } from "@/lib/types";

export type TransferState = {
  ok: boolean;
  message?: string;
};

export type BulkUpdateState = {
  ok: boolean;
  message?: string;
};

/** 담당자/부서/위치 이관 — 사유 필수, asset.transfer 감사 */
export async function transferAsset(
  _prev: TransferState,
  formData: FormData
): Promise<TransferState> {
  const { userId } = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const assignee = String(formData.get("assignee_name") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { ok: false, message: "자산 ID가 없습니다." };
  if (!reason) return { ok: false, message: "이관 사유를 입력하세요." };
  if (!assignee && !department && !location) {
    return { ok: false, message: "담당자·부서·위치 중 하나 이상 변경하세요." };
  }

  const supabase = await createClient();
  const { data: before, error: beforeErr } = await supabase
    .from("assets")
    .select("assignee_name, department, location, notes")
    .eq("id", id)
    .maybeSingle();

  if (beforeErr || !before) {
    return { ok: false, message: "자산을 찾을 수 없습니다." };
  }

  const payload: Record<string, unknown> = { updated_by: userId };
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (assignee) {
    payload.assignee_name = assignee;
    if (assignee !== (before.assignee_name ?? "")) {
      changes.assignee_name = { from: before.assignee_name, to: assignee };
    }
  }
  if (department) {
    payload.department = department;
    if (department !== (before.department ?? "")) {
      changes.department = { from: before.department, to: department };
    }
  }
  if (location) {
    payload.location = location;
    if (location !== (before.location ?? "")) {
      changes.location = { from: before.location, to: location };
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: false, message: "변경된 값이 없습니다." };
  }

  const noteLine = `[이관] ${reason}`;
  const prevNotes = (before.notes as string | null) ?? "";
  payload.notes = prevNotes ? `${prevNotes}\n${noteLine}` : noteLine;

  const { error } = await supabase.from("assets").update(payload).eq("id", id);
  if (error) {
    console.error("[transferAsset]", error.message);
    return { ok: false, message: error.message };
  }

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "asset.transfer",
    entity_type: "asset",
    entity_id: id,
    payload: { changes, reason },
  });

  revalidatePath(`/assets/${id}`);
  revalidatePath("/assets");
  revalidatePath("/admin/audit");
  return { ok: true, message: "이관이 반영되었습니다." };
}

export async function bulkUpdateAssets(
  _prev: BulkUpdateState,
  formData: FormData
): Promise<BulkUpdateState> {
  await requireAdmin();

  const idsRaw = String(formData.get("asset_ids") ?? "");
  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const statusRaw = String(formData.get("status") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (ids.length === 0) {
    return { ok: false, message: "선택된 자산이 없습니다." };
  }

  const status = statusRaw ? (statusRaw as AssetStatus) : null;
  if (!status && !location && !department) {
    return { ok: false, message: "상태·위치·부서 중 하나 이상 지정하세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_update_assets", {
    p_asset_ids: ids,
    p_status: status,
    p_location: location || null,
    p_department: department || null,
    p_reason: reason || null,
  });

  if (error) {
    console.error("[bulkUpdateAssets]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string; count?: number };
  if (!result?.ok) {
    const msg =
      result?.error === "REASON_REQUIRED"
        ? "수리·폐기 일괄 변경 시 사유가 필요합니다."
        : result?.error === "TOO_MANY"
          ? "한 번에 최대 100건까지입니다."
          : (result?.error ?? "일괄 변경 실패");
    return { ok: false, message: msg };
  }

  revalidatePath("/assets");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  return {
    ok: true,
    message: `${result.count ?? ids.length}건을 일괄 변경했습니다.`,
  };
}
