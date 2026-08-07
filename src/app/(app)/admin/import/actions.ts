"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildErrorWorkbook,
  parseImportWorkbook,
  type ImportRowError,
  type NormalizedImportRow,
} from "@/lib/import-utils";

const IMPORT_BUCKET = "imports";

export type ImportPreviewState = {
  ok: boolean;
  message?: string;
  preview?: NormalizedImportRow[];
  errors?: ImportRowError[];
  errorFileBase64?: string;
  errorDownloadUrl?: string;
  /** @deprecated 클라이언트 payload 전달 중단 — jobId만 사용 */
  payloadBase64?: string;
  jobId?: string;
  totalRows?: number;
  validRows?: number;
};

async function uploadImportObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  data: Buffer,
  contentType: string
) {
  const { error } = await supabase.storage
    .from(IMPORT_BUCKET)
    .upload(path, data, { contentType, upsert: true });
  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);
}

export async function validateImport(
  _prev: ImportPreviewState,
  formData: FormData
): Promise<ImportPreviewState> {
  const { userId } = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "파일을 선택하세요." };
  }
  if (!file.name.endsWith(".xlsx")) {
    return { ok: false, message: ".xlsx 파일만 지원합니다." };
  }

  try {
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    const parsed = parseImportWorkbook(ab);
    const supabase = await createClient();

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({
        admin_id: userId,
        file_name: file.name,
        status: "uploaded",
        total_rows: parsed.normalized.length,
        valid_rows: 0,
        error_rows: 0,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      return { ok: false, message: jobErr?.message ?? "import_jobs 생성 실패" };
    }

    const jobId = job.id as string;
    const originalPath = `${jobId}/original.xlsx`;
    await uploadImportObject(
      supabase,
      originalPath,
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

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
      const errBuf = Buffer.from(
        buildErrorWorkbook(parsed.rawRows, parsed.errors)
      );
      const errorPath = `${jobId}/errors.xlsx`;
      await uploadImportObject(
        supabase,
        errorPath,
        errBuf,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      const { data: signed } = await supabase.storage
        .from(IMPORT_BUCKET)
        .createSignedUrl(errorPath, 60 * 30);

      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          storage_path: originalPath,
          error_storage_path: errorPath,
          error_rows: parsed.errors.length,
          valid_rows: 0,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return {
        ok: false,
        message: `검증 실패: ${parsed.errors.length}건 오류 (7일 후 자동 만료)`,
        preview: parsed.preview,
        errors: parsed.errors.slice(0, 100),
        errorFileBase64: errBuf.toString("base64"),
        errorDownloadUrl: signed?.signedUrl,
        jobId,
        totalRows: parsed.normalized.length,
        validRows: 0,
      };
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "validated",
        storage_path: originalPath,
        valid_rows: parsed.normalized.length,
        error_rows: 0,
      })
      .eq("id", jobId);

    // 서버에 검증 행 저장 — 클라이언트 payload 신뢰 금지
    await supabase.from("import_rows").delete().eq("job_id", jobId);
    const rowInserts = parsed.normalized.map((r, i) => ({
      job_id: jobId,
      row_number: i + 1,
      raw_data: r,
      normalized_data: r,
      status: "valid" as const,
      errors: [],
    }));
    if (rowInserts.length) {
      const { error: rowsErr } = await supabase
        .from("import_rows")
        .insert(rowInserts);
      if (rowsErr) {
        console.error("[validateImport rows]", rowsErr.message);
        return { ok: false, message: `검증 행 저장 실패: ${rowsErr.message}` };
      }
    }

    return {
      ok: true,
      message: `${parsed.normalized.length}행 검증 통과. 반영을 진행하세요.`,
      preview: parsed.preview,
      jobId,
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
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) {
    return { ok: false, message: "검증된 작업이 없습니다. 먼저 검증하세요." };
  }

  try {
    const supabase = await createClient();

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("id, status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job || job.status !== "validated") {
      return {
        ok: false,
        message: "검증 완료된 임포트 작업만 반영할 수 있습니다.",
      };
    }

    const { data: storedRows, error: rowsErr } = await supabase
      .from("import_rows")
      .select("normalized_data")
      .eq("job_id", jobId)
      .eq("status", "valid")
      .order("row_number", { ascending: true });

    if (rowsErr || !storedRows?.length) {
      return {
        ok: false,
        message: rowsErr?.message ?? "저장된 검증 데이터가 없습니다.",
      };
    }

    const rows = storedRows.map(
      (r) => r.normalized_data as NormalizedImportRow
    );

    const { data, error } = await supabase.rpc("import_assets_batch", {
      p_rows: rows,
    });

    if (error) {
      console.error("[commitImport]", error.message);
      await supabase
        .from("import_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobId);
      return { ok: false, message: error.message };
    }

    const result = data as { ok?: boolean; count?: number };
    await supabase
      .from("import_jobs")
      .update({
        status: "committed",
        valid_rows: result.count ?? rows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await supabase
      .from("import_rows")
      .update({ status: "imported" })
      .eq("job_id", jobId)
      .eq("status", "valid");

    return {
      ok: true,
      message: `${result.count ?? rows.length}건을 반영했습니다.`,
      jobId,
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

/** 만료(7일)된 임포트 작업·Storage 객체 정리 */
export async function cleanupExpiredImports(): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cleanup_expired_import_jobs");
  if (error) {
    return { ok: false, message: error.message };
  }
  const result = data as { expired_jobs?: number };
  return {
    ok: true,
    message: `만료 처리 ${result.expired_jobs ?? 0}건`,
  };
}
