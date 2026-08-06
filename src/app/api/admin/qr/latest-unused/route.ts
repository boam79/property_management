import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** E2E/admin helper: return one unused QR token */
export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("qr_codes")
      .select("token, display_code")
      .eq("status", "unused")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "no_unused_qr" }, { status: 404 });
    }
    return NextResponse.json({ token: data.token, display_code: data.display_code });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }
}
