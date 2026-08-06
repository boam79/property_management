"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CreateQrBatchState = {
  ok: boolean;
  message?: string;
  batchId?: string;
  quantity?: number;
};

export async function createQrBatch(
  _prev: CreateQrBatchState,
  formData: FormData
): Promise<CreateQrBatchState> {
  const { userId } = await requireAdmin();
  const quantity = Number(formData.get("quantity"));

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    return { ok: false, message: "수량은 1~500 정수여야 합니다." };
  }

  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("qr_batches")
    .insert({
      quantity,
      label_format: "a4+label",
      created_by: userId,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    console.error("[createQrBatch] batch", batchError?.message);
    return { ok: false, message: batchError?.message ?? "배치 생성 실패" };
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const rows = Array.from({ length: quantity }, (_, i) => {
    const seq = String(i + 1).padStart(4, "0");
    return {
      display_code: `QR-${stamp}-${batch.id.slice(0, 6)}-${seq}`,
      status: "unused" as const,
      batch_id: batch.id,
      created_by: userId,
    };
  });

  const { error: codesError } = await supabase.from("qr_codes").insert(rows);
  if (codesError) {
    console.error("[createQrBatch] codes", codesError.message);
    await supabase.from("qr_batches").delete().eq("id", batch.id);
    return { ok: false, message: codesError.message };
  }

  revalidatePath("/admin/qr");
  return {
    ok: true,
    message: `${quantity}개 QR을 생성했습니다.`,
    batchId: batch.id,
    quantity,
  };
}
