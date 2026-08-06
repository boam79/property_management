"use client";

import { useActionState } from "react";
import {
  setProfileRole,
  type SetRoleState,
} from "@/app/(app)/admin/users/actions";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/types";

const initial: SetRoleState = { ok: false };

export function RoleChangeForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: UserRole;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(setProfileRole, initial);
  const nextRole: UserRole = currentRole === "ADMIN" ? "REGISTER" : "ADMIN";

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="role" value={nextRole} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        data-testid="set-role"
      >
        {pending
          ? "변경 중…"
          : nextRole === "ADMIN"
            ? "ADMIN 승격"
            : "REGISTER로 변경"}
      </Button>
      {state.message ? (
        <span
          className={`text-xs ${state.ok ? "text-emerald-700" : "text-destructive"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
