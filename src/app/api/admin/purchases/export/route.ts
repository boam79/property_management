import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { escapeIlikePattern } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
  const q = url.searchParams.get("q")?.trim() ?? "";
  const department = url.searchParams.get("department")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("purchase_histories")
    .select("item_name, purchase_date, department, created_at")
    .order("purchase_date", { ascending: false })
    .limit(5000);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = ["품목", "구매일자", "사용부서", "등록일시"];
  const lines = [
    header.join(","),
    ...(data ?? []).map((row) =>
      [
        csvEscape(String(row.item_name ?? "")),
        csvEscape(String(row.purchase_date ?? "")),
        csvEscape(String(row.department ?? "")),
        csvEscape(String(row.created_at ?? "")),
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
    },
  });
}
