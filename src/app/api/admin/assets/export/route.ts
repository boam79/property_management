import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssetsExportCsv,
  buildAssetsExportWorkbook,
  type ExportAssetRow,
} from "@/lib/export-assets";
import { escapeIlikePattern } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/assets/export?format=xlsx|csv&q=&asset_type=&status=&location=&unlinked=1
 * Admin only. Matches import headers for round-trip.
 */
export async function GET(request: Request) {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
  const q = url.searchParams.get("q")?.trim() ?? "";
  const assetType = url.searchParams.get("asset_type") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const location = url.searchParams.get("location") ?? "";
  const unlinked = url.searchParams.get("unlinked") === "1";

  const supabase = await createClient();
  let query = supabase
    .from("assets")
    .select(
      "asset_no, name, asset_type, category, status, serial_no, manufacturer, model_name, location, department, assignee_name, notes, purchase_date, purchase_price, qr_code_id, qr_codes:qr_code_id(token)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (assetType) query = query.eq("asset_type", assetType);
  if (status) query = query.eq("status", status);
  if (location) {
    if (location === "미지정") {
      query = query.or("location.is.null,location.eq.");
    } else {
      query = query.eq("location", location);
    }
  }
  if (unlinked) query = query.is("qr_code_id", null);
  if (q) {
    const safe = escapeIlikePattern(q);
    query = query.or(
      `asset_no.ilike.%${safe}%,name.ilike.%${safe}%,location.ilike.%${safe}%,serial_no.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[assets export]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: ExportAssetRow[] = (data ?? []).map((row) => {
    const qrJoin = row.qr_codes as { token?: string } | { token?: string }[] | null;
    const token = Array.isArray(qrJoin)
      ? (qrJoin[0]?.token ?? null)
      : (qrJoin?.token ?? null);
    return {
      asset_no: row.asset_no as string,
      name: row.name as string,
      asset_type: row.asset_type as string,
      category: row.category as string,
      status: row.status as string,
      serial_no: (row.serial_no as string | null) ?? null,
      manufacturer: (row.manufacturer as string | null) ?? null,
      model_name: (row.model_name as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      department: (row.department as string | null) ?? null,
      assignee_name: (row.assignee_name as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      purchase_date: (row.purchase_date as string | null) ?? null,
      purchase_price: (row.purchase_price as number | null) ?? null,
      qr_token: token,
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = buildAssetsExportCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="assets-export-${stamp}.csv"`,
      },
    });
  }

  const buf = buildAssetsExportWorkbook(rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assets-export-${stamp}.xlsx"`,
    },
  });
}
