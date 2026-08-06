"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildErrorWorkbook,
  parseImportWorkbook,
  type ImportRowError,
  type NormalizedImportRow,
} from "@/lib/import-utils";

export type ImportPreviewState = {
  ok: boolean;
  message?: string;
  preview?: NormalizedImportRow[];
  errors?: ImportRowError[];
  errorFileBase64?: string;
  payloadBase64?: string;
  totalRows?: number;
  validRows?: number;
};

export async function validateImport(
  _prev: ImportPreviewState,
  formData: FormData
): Promise<ImportPreviewState> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "파일을 선택하세요." };
  }
  if (!file.name.endsWith(".xlsx")) {
    return { ok: false, message: ".xlsx 파일만 지원합니다." };
  }

  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseImportWorkbook(buffer);
    const supabase = await createClient();

    const assetNos = parsed.normalized.map((r) => r.asset_no).filter(Boolean);
    const serials = parsed.normalized
      .map((r) => r.serial_no)
      .filter((s): s is string => !!s);
    const qrTokens = parsed.normalized
      .map((r) => r.qr_token)
      .filter((s): s is string => !!s);

    if (assetNos.length) {
      const { data: existing } = await supabase
        .from("assets")
        .select("asset_no")
        .in("asset_no", assetNos);
      const set = new Set((existing ?? []).map((e) => e.asset_no as string));
      parsed.normalized.forEach((r, idx) => {
        if (set.has(r.asset_no)) {
          parsed.errors.push({
            rowNumber: idx + 2,
            column: "자산번호",
            code: "DUP_DB",
            message: "DB에 이미 존재하는 자산번호",
            value: r.asset_no,
          });
        }
      });
    }

    if (serials.length) {
      const { data: existing } = await supabase
        .from("assets")
        .select("serial_no")
        .in("serial_no", serials);
      const set = new Set(
        (existing ?? []).map((e) => e.serial_no as string).filter(Boolean)
      );
      parsed.normalized.forEach((r, idx) => {
        if (r.serial_no && set.has(r.serial_no)) {
          parsed.errors.push({
            rowNumber: idx + 2,
            column: "시리얼번호",
            code: "DUP_DB",
            message: "DB에 이미 존재하는 시리얼",
            value: r.serial_no,
          });
        }
      });
    }

    if (qrTokens.length) {
      const { data: qrs } = await supabase
        .from("qr_codes")
        .select("token, status")
        .in("token", qrTokens);
      const map = new Map(
        (qrs ?? []).map((q) => [q.token as string, q.status as string])
      );
      parsed.normalized.forEach((r, idx) => {
        if (!r.qr_token) return;
        const status = map.get(r.qr_token);
        if (!status) {
          parsed.errors.push({
            rowNumber: idx + 2,
            column: "QR 식별값",
            code: "QR_NOT_FOUND",
            message: "존재하지 않는 QR token",
            value: r.qr_token,
          });
        } else if (status !== "unused") {
          parsed.errors.push({
            rowNumber: idx + 2,
            column: "QR 식별값",
            code: "QR_NOT_UNUSED",
            message: "unused 상태가 아닌 QR",
            value: r.qr_token,
          });
        }
      });
    }

    if (parsed.errors.length > 0) {
      const errBuf = buildErrorWorkbook(parsed.rawRows, parsed.errors);
      return {
        ok: false,
        message: `검증 실패: ${parsed.errors.length}건 오류`,
        preview: parsed.preview,
        errors: parsed.errors.slice(0, 100),
        errorFileBase64: Buffer.from(errBuf).toString("base64"),
        totalRows: parsed.normalized.length,
        validRows: 0,
      };
    }

    return {
      ok: true,
      message: `${parsed.normalized.length}행 검증 통과. 반영을 진행하세요.`,
      preview: parsed.preview,
      payloadBase64: Buffer.from(
        JSON.stringify(parsed.normalized),
        "utf8"
      ).toString("base64"),
      totalRows: parsed.normalized.length,
      validRows: parsed.normalized.length,
    };
  } catch (e) {
    console.error("[validateImport]", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "검증 중 오류",
    };
  }
}

export async function commitImport(
  _prev: ImportPreviewState,
  formData: FormData
): Promise<ImportPreviewState> {
  await requireAdmin();
  const payloadBase64 = String(formData.get("payloadBase64") ?? "");
  if (!payloadBase64) {
    return { ok: false, message: "검증된 데이터가 없습니다. 먼저 검증하세요." };
  }

  try {
    const rows = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString("utf8")
    ) as NormalizedImportRow[];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_assets_batch", {
      p_rows: rows,
    });

    if (error) {
      console.error("[commitImport]", error.message);
      return { ok: false, message: error.message };
    }

    const result = data as { ok?: boolean; count?: number };
    return {
      ok: true,
      message: `${result.count ?? rows.length}건을 반영했습니다.`,
      totalRows: rows.length,
      validRows: result.count ?? rows.length,
    };
  } catch (e) {
    console.error("[commitImport]", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "반영 중 오류",
    };
  }
}
