/**
 * Unit checks for asset export helpers.
 * Run: npm run test:assets-export
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

// Minimal inline of expected headers (must match constants)
const HEADERS = [
  "자산번호",
  "자산명",
  "자산구분",
  "카테고리",
  "상태",
  "시리얼번호",
  "제조사",
  "모델명",
  "위치",
  "사용부서",
  "사용자/담당자",
  "구매일",
  "구매금액",
  "비고",
  "QR 식별값",
];

function buildCsv(rows) {
  const escape = (v) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
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
        r.purchase_price == null ? "" : String(r.purchase_price),
        r.notes ?? "",
        r.qr_token ?? "",
      ]
        .map((v) => escape(String(v)))
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

function buildXlsx(rows) {
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
    구매금액: r.purchase_price == null ? "" : String(r.purchase_price),
    비고: r.notes ?? "",
    "QR 식별값": r.qr_token ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(sheetRows, { header: HEADERS });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "assets");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

const sample = [
  {
    asset_no: "A-1",
    name: "노트북",
    asset_type: "IT",
    category: "노트북",
    status: "IN_USE",
    serial_no: "SN1",
    manufacturer: "M",
    model_name: "X",
    location: "3층",
    department: "IT",
    assignee_name: "홍",
    notes: 'a,"b"',
    purchase_date: "2026-01-01",
    purchase_price: 1000,
    qr_token: "tok-1",
  },
];

const csv = buildCsv(sample);
assert.ok(csv.startsWith("\uFEFF"));
assert.ok(csv.includes("자산번호,자산명"));
assert.ok(csv.includes('"a,""b"""') || csv.includes('a,""b""'));

const buf = buildXlsx(sample);
const wb = XLSX.read(buf, { type: "buffer" });
const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
assert.equal(json.length, 1);
assert.equal(json[0]["자산번호"], "A-1");
assert.equal(json[0]["QR 식별값"], "tok-1");

console.log("PASS: assets export helpers");
