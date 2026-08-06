"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export type SetRoleState = {
  ok: boolean;
  message?: string;
};

export async function setProfileRole(
  _prev: SetRoleState,
  formData: FormData
): Promise<SetRoleState> {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!userId || (role !== "ADMIN" && role !== "REGISTER")) {
    return { ok: false, message: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_profile_role", {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    console.error("[setProfileRole]", error.message);
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    const msg =
      result?.error === "CANNOT_CHANGE_OWN_ROLE"
        ? "본인 역할은 변경할 수 없습니다."
        : result?.error === "LAST_ADMIN"
          ? "마지막 관리자는 해제할 수 없습니다."
          : (result?.error ?? "실패");
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return { ok: true, message: `역할을 ${role}(으)로 변경했습니다.` };
}
