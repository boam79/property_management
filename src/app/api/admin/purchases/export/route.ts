import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvEscapeCell, escapeIlikePattern, isIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const Q_MAX = 200;
const DEPARTMENT_MAX = 100;
const EXPORT_LIMIT = 5000;

/**
 * GET /api/admin/purchases/export?format=csv&q=&department=&from=&to=
 * Admin only.
 */
export async function GET(request: Request) {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")?.trim() ?? "").slice(0, Q_MAX);
  const department = (url.searchParams.get("department")?.trim() ?? "").slice(
    0,
    DEPARTMENT_MAX
  );
  const fromRaw = url.searchParams.get("from")?.trim() ?? "";
  const toRaw = url.searchParams.get("to")?.trim() ?? "";
  const from = fromRaw && isIsoDate(fromRaw) ? fromRaw : "";
  const to = toRaw && isIsoDate(toRaw) ? toRaw : "";

  const supabase = await createClient();
  let query = supabase
    .from("purchase_histories")
    .select("item_name, purchase_date, department, created_at")
    .order("purchase_date", { ascending: false })
    .limit(EXPORT_LIMIT);

  if (q) {
    query = query.ilike("item_name", `%${escapeIlikePattern(q)}%`);
  }
  if (department) {
    query = query.ilike("department", `%${escapeIlikePattern(department)}%`);
  }
  if (from) {
    query = query.gte("purchase_date", from);
  }
  if (to) {
    query = query.lte("purchase_date", to);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[purchases export]", error.message);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const header = ["품목", "구매일자", "사용부서", "등록일시"];
  const lines = [
    header.join(","),
    ...(data ?? []).map((row) =>
      [
        csvEscapeCell(String(row.item_name ?? "")),
        csvEscapeCell(String(row.purchase_date ?? "")),
        csvEscapeCell(String(row.department ?? "")),
        csvEscapeCell(String(row.created_at ?? "")),
      ].join(",")
    ),
  ];

  const bom = "\uFEFF";
  const body = bom + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-histories-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
