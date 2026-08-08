/**
 * REGISTER 계정 동시 등록 스트레스 테스트 (배포 Supabase 대상)
 *
 * A) 동일 QR 토큰에 20건 경합 → 성공 1건만 기대
 * B) 서로 다른 QR 20개에 동시 등록 → 성공 20건 기대
 *
 * 사용:
 *   CONCURRENCY=20 node --env-file=/tmp/supabase-public.env scripts/register-concurrency-20.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  for (const p of [
    resolve(process.cwd(), ".env.local"),
    "/tmp/supabase-public.env",
  ]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "Admin123!";
const registerEmail =
  process.env.TEST_REGISTER_EMAIL ?? "register@example.com";
const registerPassword =
  process.env.TEST_REGISTER_PASSWORD ?? "Register123!";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);

async function authedClient(email, password) {
  const base = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await base.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw error ?? new Error(`login failed: ${email}`);
  }
  return {
    client: createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    userId: data.user.id,
    email,
  };
}

function summarize(label, results) {
  let ok = 0;
  let already = 0;
  let other = 0;
  const otherBodies = [];
  const rpcErrors = [];
  const assetIds = new Set();

  for (const r of results) {
    if (r.error) {
      other++;
      rpcErrors.push(r.error.message);
      continue;
    }
    const body = r.data;
    if (body?.ok) {
      ok++;
      if (body.asset_id) assetIds.add(body.asset_id);
    } else if (body?.error === "QR_ALREADY_ASSIGNED") {
      already++;
    } else {
      other++;
      otherBodies.push(body);
    }
  }

  const summary = {
    label,
    ok,
    already,
    other,
    uniqueAssetIds: assetIds.size,
    CONCURRENCY: results.length,
    rpcErrors: [...new Set(rpcErrors)].slice(0, 10),
    otherBodies: otherBodies.slice(0, 10),
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function scenarioRaceSameQr(admin, register) {
  const token = randomUUID();
  const { error: qrErr } = await admin.from("qr_codes").insert({
    token,
    display_code: `RACE-${token.slice(0, 8)}`,
    status: "unused",
  });
  if (qrErr) throw new Error(`QR create failed: ${qrErr.message}`);

  console.log(`\n[A] REGISTER race ${CONCURRENCY}x same token=${token}`);
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) =>
      register.rpc("assign_qr_and_create_asset", {
        p_token: token,
        p_asset_no: `RACE-${token.slice(0, 6)}-${i}-${Date.now()}`,
        p_name: `Race ${i}`,
        p_asset_type: "GENERAL",
        p_category: "concurrency",
        p_status: "IN_USE",
      })
    )
  );
  const elapsedMs = Date.now() - started;
  const summary = summarize("A_same_qr_race", results);
  summary.elapsedMs = elapsedMs;

  // DB truth
  const { data: qr } = await admin
    .from("qr_codes")
    .select("status, asset_id")
    .eq("token", token)
    .maybeSingle();
  const { count: assetCount } = await admin
    .from("assets")
    .select("id", { count: "exact", head: true })
    .like("asset_no", `RACE-${token.slice(0, 6)}-%`);

  summary.db = { qr, assetCount };
  console.log("[A] db", JSON.stringify(summary.db));
  summary.pass = summary.ok === 1 && summary.uniqueAssetIds === 1;
  return summary;
}

async function scenarioParallelDistinct(admin, register) {
  const batchId = randomUUID();
  const tokens = Array.from({ length: CONCURRENCY }, () => randomUUID());
  const rows = tokens.map((token, i) => ({
    token,
    display_code: `PAR-${batchId.slice(0, 6)}-${i}`,
    status: "unused",
  }));

  const { error: qrErr } = await admin.from("qr_codes").insert(rows);
  if (qrErr) throw new Error(`bulk QR create failed: ${qrErr.message}`);

  console.log(`\n[B] REGISTER parallel ${CONCURRENCY}x distinct QRs`);
  const started = Date.now();
  const results = await Promise.all(
    tokens.map((token, i) =>
      register.rpc("assign_qr_and_create_asset", {
        p_token: token,
        p_asset_no: `PAR-${batchId.slice(0, 6)}-${i}`,
        p_name: `Parallel ${i}`,
        p_asset_type: "IT",
        p_category: "concurrency",
        p_status: "IN_USE",
      })
    )
  );
  const elapsedMs = Date.now() - started;
  const summary = summarize("B_parallel_distinct", results);
  summary.elapsedMs = elapsedMs;

  const { count: assigned } = await admin
    .from("qr_codes")
    .select("id", { count: "exact", head: true })
    .in("token", tokens)
    .eq("status", "assigned");
  const { count: unused } = await admin
    .from("qr_codes")
    .select("id", { count: "exact", head: true })
    .in("token", tokens)
    .eq("status", "unused");

  summary.db = { assigned, unused };
  console.log("[B] db", JSON.stringify(summary.db));
  summary.pass =
    summary.ok === CONCURRENCY &&
    summary.uniqueAssetIds === CONCURRENCY &&
    assigned === CONCURRENCY;
  return summary;
}

async function main() {
  if (!url || !anon) throw new Error("Missing Supabase env");

  console.log(
    JSON.stringify(
      {
        url,
        CONCURRENCY,
        adminEmail,
        registerEmail,
      },
      null,
      2
    )
  );

  const adminAuth = await authedClient(adminEmail, adminPassword);
  const registerAuth = await authedClient(registerEmail, registerPassword);

  // role check
  const { data: regProfile, error: profErr } = await registerAuth.client
    .from("profiles")
    .select("role, display_name")
    .eq("id", registerAuth.userId)
    .maybeSingle();
  console.log("register profile", regProfile, profErr?.message ?? null);
  if (regProfile && regProfile.role !== "REGISTER") {
    console.warn("WARN: expected REGISTER role, got", regProfile.role);
  }

  const a = await scenarioRaceSameQr(adminAuth.client, registerAuth.client);
  const b = await scenarioParallelDistinct(adminAuth.client, registerAuth.client);

  const report = {
    pass: a.pass && b.pass,
    A: a,
    B: b,
    findings: [],
  };

  if (!a.pass) {
    report.findings.push(
      `A(동일 QR 경합): ok=${a.ok} uniqueAssets=${a.uniqueAssetIds} (기대 ok=1). already=${a.already} other=${a.other}`
    );
  } else {
    report.findings.push("A(동일 QR 경합): PASS — 성공 1건만 발생");
  }
  if (!b.pass) {
    report.findings.push(
      `B(서로 다른 QR 20): ok=${b.ok}/${CONCURRENCY} uniqueAssets=${b.uniqueAssetIds} assigned=${b.db?.assigned}`
    );
  } else {
    report.findings.push(
      `B(서로 다른 QR 20): PASS — ${b.ok}건 성공, ${b.elapsedMs}ms`
    );
  }
  if (a.rpcErrors?.length || b.rpcErrors?.length) {
    report.findings.push(
      `RPC 에러 샘플: ${[...(a.rpcErrors || []), ...(b.rpcErrors || [])].join(" | ")}`
    );
  }

  console.log("\n=== REPORT ===");
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
