import * as XLSX from "xlsx";
import {
  EXPORT_HEADERS,
  IMPORT_OPTIONAL_HEADERS,
  IMPORT_REQUIRED_HEADERS,
} from "@/lib/constants";

export type ExportAssetRow = {
  asset_no: string;
  name: string;
  asset_type: string;
  category: string;
  status: string;
  serial_no: string | null;
  manufacturer: string | null;
  model_name: string | null;
  location: string | null;
  department: string | null;
  assignee_name: string | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_price: number | string | null;
  qr_token: string | null;
};

/** Build import-compatible xlsx from asset rows (Korean headers). */
export function buildAssetsExportWorkbook(rows: ExportAssetRow[]): Buffer {
  const headers = [...IMPORT_REQUIRED_HEADERS, ...IMPORT_OPTIONAL_HEADERS];
  const sheetRows = rows.map((r) => ({
    자산번호: r.asset_no,
    자산명: r.name,
    자산구분: r.asset_type,
    카테고리: r.category,
    상태: r.status,
    시리얼번호: r.serial_no ?? "",
    제조사: r.manufacturer ?? "",
    모델명: r.model_name ?? "",
    위치: r.location ?? "",
    사용부서: r.department ?? "",
    "사용자/담당자": r.assignee_name ?? "",
    구매일: r.purchase_date ?? "",
    구매금액:
      r.purchase_price === null || r.purchase_price === undefined
        ? ""
        : String(r.purchase_price),
    비고: r.notes ?? "",
    "QR 식별값": r.qr_token ?? "",
  }));

  const sheet =
    sheetRows.length > 0
      ? XLSX.utils.json_to_sheet(sheetRows, { header: [...headers] })
      : XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "assets");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** CSV (UTF-8 BOM) matching the same headers for Excel open. */
export function buildAssetsExportCsv(rows: ExportAssetRow[]): string {
  const headers = [...EXPORT_HEADERS];
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const values = [
      r.asset_no,
      r.name,
      r.asset_type,
      r.category,
      r.status,
      r.serial_no ?? "",
      r.manufacturer ?? "",
      r.model_name ?? "",
      r.location ?? "",
      r.department ?? "",
      r.assignee_name ?? "",
      r.purchase_date ?? "",
      r.purchase_price === null || r.purchase_price === undefined
        ? ""
        : String(r.purchase_price),
      r.notes ?? "",
      r.qr_token ?? "",
    ];
    lines.push(values.map((v) => escape(String(v))).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}
