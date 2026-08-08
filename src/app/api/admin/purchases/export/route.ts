import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Purchase history moved to local desktop app. */
export async function GET() {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    {
      error: "Moved",
      message:
        "구매이력 CSV는 로컬 구매이력 앱에서 내보내기·가져오기 하세요.",
    },
    { status: 410 }
  );
}
