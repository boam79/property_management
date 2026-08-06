/**
 * Concurrent QR assignment stress test.
 * Admin creates unused QR, then N parallel assign RPCs race.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.TEST_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "Admin123!";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);

async function authedClient(email, password) {
  const base = createClient(url, anon);
  const { data, error } = await base.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error(`login failed: ${email}`);
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function main() {
  if (!url || !anon) throw new Error("Missing Supabase env");

  const admin = await authedClient(adminEmail, adminPassword);
  const token = randomUUID();
  const { error: qrErr } = await admin.from("qr_codes").insert({
    token,
    display_code: `STRESS-${token.slice(0, 8)}`,
    status: "unused",
  });
  if (qrErr) throw new Error(`QR create failed: ${qrErr.message}`);

  console.log(`Racing ${CONCURRENCY} assigns on token=${token}`);
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) =>
      admin.rpc("assign_qr_and_create_asset", {
        p_token: token,
        p_asset_no: `STRESS-${token.slice(0, 6)}-${i}-${Date.now()}`,
        p_name: `Stress ${i}`,
        p_asset_type: "IT",
        p_category: "test",
        p_status: "IN_USE",
      })
    )
  );

  let ok = 0;
  let already = 0;
  let other = 0;
  for (const r of results) {
    if (r.error) {
      other++;
      console.log("rpc error", r.error.message);
      continue;
    }
    const body = r.data;
    if (body?.ok) ok++;
    else if (body?.error === "QR_ALREADY_ASSIGNED") already++;
    else {
      other++;
      console.log("body", body);
    }
  }

  console.log(JSON.stringify({ ok, already, other, CONCURRENCY }, null, 2));
  if (ok !== 1) {
    console.error("FAIL: expected exactly 1 success");
    process.exit(1);
  }
  console.log("PASS: exactly one concurrent assign succeeded");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
