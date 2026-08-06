import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentProfile } from "@/lib/auth";
import {
  IMPORT_OPTIONAL_HEADERS,
  IMPORT_REQUIRED_HEADERS,
} from "@/lib/constants";

export async function GET() {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const headers = [...IMPORT_REQUIRED_HEADERS, ...IMPORT_OPTIONAL_HEADERS];
  const sample = [
    {
      자산번호: "A-0001",
      자산명: "샘플 노트북",
      자산구분: "IT",
      카테고리: "노트북",
      상태: "IN_USE",
      시리얼번호: "SN-EXAMPLE",
      제조사: "Example",
      모델명: "Model-1",
      위치: "본사 3층",
      사용부서: "IT팀",
      "사용자/담당자": "홍길동",
      구매일: "2026-01-15",
      구매금액: "1200000",
      비고: "샘플",
      "QR 식별값": "",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(sample, { header: headers });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "assets");
  const buf = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="asset-import-template.xlsx"',
    },
  });
}
