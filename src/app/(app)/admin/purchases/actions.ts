"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PurchaseActionState = {
  ok: boolean;
  message?: string;
};

function parsePurchaseFields(formData: FormData) {
  const itemName = String(formData.get("item_name") ?? "").trim();
  const purchaseDate = String(formData.get("purchase_date") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  return { itemName, purchaseDate, department };
}

export async function createPurchaseHistory(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const { userId } = await requireAdmin();
  const { itemName, purchaseDate, department } = parsePurchaseFields(formData);

  if (!itemName || !purchaseDate || !department) {
    return { ok: false, message: "품목, 구매일자, 사용부서를 모두 입력하세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_histories").insert({
    item_name: itemName,
    purchase_date: purchaseDate,
    department,
    user_id: userId,
  });

  if (error) {
    console.error("[createPurchaseHistory]", error.message);
    return { ok: false, message: error.message };
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
  const { itemName, purchaseDate, department } = parsePurchaseFields(formData);

  if (!id) {
    return { ok: false, message: "대상이 없습니다." };
  }
  if (!itemName || !purchaseDate || !department) {
    return { ok: false, message: "품목, 구매일자, 사용부서를 모두 입력하세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_histories")
    .update({
      item_name: itemName,
      purchase_date: purchaseDate,
      department,
    })
    .eq("id", id);

  if (error) {
    console.error("[updatePurchaseHistory]", error.message);
    return { ok: false, message: error.message };
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
  if (!id) {
    return { ok: false, message: "대상이 없습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_histories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deletePurchaseHistory]", error.message);
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/statistics");
  return { ok: true, message: "구매이력을 삭제했습니다." };
}
