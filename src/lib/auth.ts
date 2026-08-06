import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirectPath } from "@/lib/redirect";
import type { Profile, UserRole } from "@/lib/types";

export { isSafeRedirectPath };

export async function getCurrentProfile(): Promise<{
  userId: string;
  profile: Profile;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    console.error("[auth] profile lookup failed", error?.message);
    return null;
  }

  return {
    userId: user.id,
    profile: profile as Profile,
  };
}

export async function requireAuth(redirectTo?: string) {
  const current = await getCurrentProfile();
  if (!current) {
    const q =
      redirectTo && isSafeRedirectPath(redirectTo)
        ? `?redirect=${encodeURIComponent(redirectTo)}`
        : "";
    redirect(`/login${q}`);
  }
  return current;
}

export async function requireAdmin() {
  const current = await requireAuth("/admin");
  if (current.profile.role !== ("ADMIN" satisfies UserRole)) {
    redirect("/assets");
  }
  return current;
}
