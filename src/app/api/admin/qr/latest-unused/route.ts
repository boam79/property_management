import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * E2E 전용 헬퍼. 프로덕션에서는 ENABLE_E2E_HELPERS=1 일 때만 동작.
 * 미사용 QR 토큰 오라클이므로 기본 비활성.
 */
export async function GET() {
  if (process.env.ENABLE_E2E_HELPERS !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

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
    return NextResponse.json({
      token: data.token,
      display_code: data.display_code,
    });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }
}
