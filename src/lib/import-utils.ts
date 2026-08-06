import * as XLSX from "xlsx";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_OPTIONAL_HEADERS,
  IMPORT_REQUIRED_HEADERS,
} from "@/lib/constants";
import type { AssetStatus, AssetType } from "@/lib/types";

export type NormalizedImportRow = {
  asset_no: string;
  name: string;
  asset_type: AssetType;
  category: string;
  status: AssetStatus;
  serial_no: string | null;
  manufacturer: string | null;
  model_name: string | null;
  location: string | null;
  department: string | null;
  assignee_name: string | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_price: string | null;
  qr_token: string | null;
};

export type ImportRowError = {
  rowNumber: number;
  column?: string;
  code: string;
  message: string;
  value?: string;
};

export type ParsedImport = {
  headers: string[];
  rawRows: Record<string, string>[];
  normalized: NormalizedImportRow[];
  errors: ImportRowError[];
  preview: NormalizedImportRow[];
};

const HEADER_MAP: Record<string, keyof NormalizedImportRow> = {
  자산번호: "asset_no",
  자산명: "name",
  자산구분: "asset_type",
  카테고리: "category",
  상태: "status",
  시리얼번호: "serial_no",
  제조사: "manufacturer",
  모델명: "model_name",
  위치: "location",
  사용부서: "department",
  "사용자/담당자": "assignee_name",
  구매일: "purchase_date",
  구매금액: "purchase_price",
  "QR 식별값": "qr_token",
};

export function parseImportWorkbook(buffer: ArrayBuffer): ParsedImport {
  if (buffer.byteLength > IMPORT_MAX_BYTES) {
    throw new Error(`파일 크기는 ${IMPORT_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`);
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("워크시트가 없습니다.");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) throw new Error("데이터 행이 없습니다.");
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new Error(`최대 ${IMPORT_MAX_ROWS}행까지 허용됩니다.`);
  }

  const headers = Object.keys(rows[0] ?? {});
  for (const required of IMPORT_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(`필수 컬럼 누락: ${required}`);
    }
  }

  const rawRows = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) {
      out[h] = String(r[h] ?? "").trim();
    }
    return out;
  });

  const errors: ImportRowError[] = [];
  const normalized: NormalizedImportRow[] = [];
  const assetNos = new Set<string>();
  const serials = new Set<string>();
  const qrTokens = new Set<string>();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const row: NormalizedImportRow = {
      asset_no: raw["자산번호"] ?? "",
      name: raw["자산명"] ?? "",
      asset_type: (raw["자산구분"] ?? "") as AssetType,
      category: raw["카테고리"] ?? "",
      status: (raw["상태"] ?? "") as AssetStatus,
      serial_no: empty(raw["시리얼번호"]),
      manufacturer: empty(raw["제조사"]),
      model_name: empty(raw["모델명"]),
      location: empty(raw["위치"]),
      department: empty(raw["사용부서"]),
      assignee_name: empty(raw["사용자/담당자"]),
      notes: empty(raw["비고"]),
      purchase_date: empty(raw["구매일"]),
      purchase_price: empty(raw["구매금액"]),
      qr_token: empty(raw["QR 식별값"]),
    };

    if (!row.asset_no) {
      errors.push({
        rowNumber,
        column: "자산번호",
        code: "REQUIRED",
        message: "자산번호는 필수입니다.",
      });
    } else if (assetNos.has(row.asset_no)) {
      errors.push({
        rowNumber,
        column: "자산번호",
        code: "DUP_FILE",
        message: "파일 내 자산번호 중복",
        value: row.asset_no,
      });
    } else {
      assetNos.add(row.asset_no);
    }

    if (!row.name) {
      errors.push({
        rowNumber,
        column: "자산명",
        code: "REQUIRED",
        message: "자산명은 필수입니다.",
      });
    }
    if (!row.category) {
      errors.push({
        rowNumber,
        column: "카테고리",
        code: "REQUIRED",
        message: "카테고리는 필수입니다.",
      });
    }
    if (row.asset_type !== "GENERAL" && row.asset_type !== "IT") {
      errors.push({
        rowNumber,
        column: "자산구분",
        code: "INVALID",
        message: "GENERAL 또는 IT",
        value: row.asset_type,
      });
    }
    if (!["IN_USE", "IN_STOCK", "REPAIR", "DISPOSED"].includes(row.status)) {
      errors.push({
        rowNumber,
        column: "상태",
        code: "INVALID",
        message: "IN_USE/IN_STOCK/REPAIR/DISPOSED",
        value: row.status,
      });
    }
    if (row.serial_no) {
      if (serials.has(row.serial_no)) {
        errors.push({
          rowNumber,
          column: "시리얼번호",
          code: "DUP_FILE",
          message: "파일 내 시리얼 중복",
          value: row.serial_no,
        });
      } else serials.add(row.serial_no);
    }
    if (row.qr_token) {
      if (qrTokens.has(row.qr_token)) {
        errors.push({
          rowNumber,
          column: "QR 식별값",
          code: "DUP_FILE",
          message: "파일 내 QR 중복",
          value: row.qr_token,
        });
      } else qrTokens.add(row.qr_token);
    }
    if (row.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date)) {
      errors.push({
        rowNumber,
        column: "구매일",
        code: "INVALID",
        message: "YYYY-MM-DD 형식",
        value: row.purchase_date,
      });
    }
    if (row.purchase_price) {
      const n = Number(row.purchase_price);
      if (Number.isNaN(n) || n < 0) {
        errors.push({
          rowNumber,
          column: "구매금액",
          code: "INVALID",
          message: "0 이상 숫자",
          value: row.purchase_price,
        });
      }
    }

    normalized.push(row);
  });

  void HEADER_MAP;
  void IMPORT_OPTIONAL_HEADERS;

  return {
    headers,
    rawRows,
    normalized,
    errors,
    preview: normalized.slice(0, 50),
  };
}

export function buildErrorWorkbook(
  rawRows: Record<string, string>[],
  errors: ImportRowError[]
) {
  const byRow = new Map<number, string[]>();
  for (const e of errors) {
    const list = byRow.get(e.rowNumber) ?? [];
    list.push(`[${e.code}] ${e.column ?? ""} ${e.message}`);
    byRow.set(e.rowNumber, list);
  }

  const out = rawRows.map((raw, idx) => ({
    ...raw,
    오류내용: (byRow.get(idx + 2) ?? []).join("; "),
  }));

  const sheet = XLSX.utils.json_to_sheet(out);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "errors");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function empty(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s || null;
}
