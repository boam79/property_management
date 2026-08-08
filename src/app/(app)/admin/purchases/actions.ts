"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, isUuid } from "@/lib/utils";

export type PurchaseActionState = {
  ok: boolean;
  message?: string;
};

const ITEM_NAME_MAX = 200;
const DEPARTMENT_MAX = 100;

function parsePurchaseFields(formData: FormData) {
  const itemName = String(formData.get("item_name") ?? "").trim();
  const purchaseDate = String(formData.get("purchase_date") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  return { itemName, purchaseDate, department };
}

function validatePurchaseFields(fields: {
  itemName: string;
  purchaseDate: string;
  department: string;
}): PurchaseActionState | null {
  const { itemName, purchaseDate, department } = fields;
  if (!itemName || !purchaseDate || !department) {
    return { ok: false, message: "품목, 구매일자, 사용부서를 모두 입력하세요." };
  }
  if (itemName.length > ITEM_NAME_MAX) {
    return { ok: false, message: `품목은 ${ITEM_NAME_MAX}자 이하여야 합니다.` };
  }
  if (department.length > DEPARTMENT_MAX) {
    return {
      ok: false,
      message: `사용부서는 ${DEPARTMENT_MAX}자 이하여야 합니다.`,
    };
  }
  if (!isIsoDate(purchaseDate)) {
    return { ok: false, message: "구매일자 형식이 올바르지 않습니다." };
  }
  return null;
}

export async function createPurchaseHistory(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { userId } = await requireAdmin();
  const fields = parsePurchaseFields(formData);
  const invalid = validatePurchaseFields(fields);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_histories").insert({
    item_name: fields.itemName,
    purchase_date: fields.purchaseDate,
    department: fields.department,
    user_id: userId,
  });

  if (error) {
    console.error("[createPurchaseHistory]", error.message);
    return { ok: false, message: "구매이력 등록에 실패했습니다." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/statistics");
  return { ok: true, message: "구매이력을 등록했습니다." };
}

export async function updatePurchaseHistory(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const fields = parsePurchaseFields(formData);

  if (!id || !isUuid(id)) {
    return { ok: false, message: "대상이 없습니다." };
  }
  const invalid = validatePurchaseFields(fields);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_histories")
    .update({
      item_name: fields.itemName,
      purchase_date: fields.purchaseDate,
      department: fields.department,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updatePurchaseHistory]", error.message);
    return { ok: false, message: "구매이력 수정에 실패했습니다." };
  }
  if (!data) {
    return { ok: false, message: "대상을 찾을 수 없습니다." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/statistics");
  return { ok: true, message: "구매이력을 수정했습니다." };
}

export async function deletePurchaseHistory(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id || !isUuid(id)) {
    return { ok: false, message: "대상이 없습니다." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_histories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[deletePurchaseHistory]", error.message);
    return { ok: false, message: "구매이력 삭제에 실패했습니다." };
  }
  if (!data) {
    return { ok: false, message: "대상을 찾을 수 없습니다." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/statistics");
  return { ok: true, message: "구매이력을 삭제했습니다." };
}
