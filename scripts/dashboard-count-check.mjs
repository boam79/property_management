import { createClient } from "@supabase/supabase-js";
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
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (do not hardcode).");
}

async function countAssets(supabase, filters) {
  let q = supabase.from("assets").select("id", { count: "exact", head: true });
  if (filters.asset_type) q = q.eq("asset_type", filters.asset_type);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.location === "미지정") q = q.or("location.is.null,location.eq.");
  else if (filters.location) q = q.eq("location", filters.location);
  if (filters.unlinked) q = q.is("qr_code_id", null);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  if (!url || !anon) throw new Error("Missing Supabase env");
  const base = createClient(url, anon);
  const { data: auth, error: authErr } = await base.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr || !auth.session) throw authErr ?? new Error("login failed");
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
  });

  const cases = [
    {
      name: "all",
      list: {},
      rpc: { p_asset_type: null, p_status: null, p_location: null },
      pick: (s) => s.total,
    },
    {
      name: "filter GENERAL",
      list: { asset_type: "GENERAL" },
      rpc: { p_asset_type: "GENERAL", p_status: null, p_location: null },
      pick: (s) => s.total,
    },
    {
      name: "filter IT",
      list: { asset_type: "IT" },
      rpc: { p_asset_type: "IT", p_status: null, p_location: null },
      pick: (s) => s.total,
    },
    {
      name: "filter IN_USE",
      list: { status: "IN_USE" },
      rpc: { p_asset_type: null, p_status: "IN_USE", p_location: null },
      pick: (s) => s.total,
    },
    {
      name: "card general_count (no filter)",
      list: { asset_type: "GENERAL" },
      rpc: { p_asset_type: null, p_status: null, p_location: null },
      pick: (s) => s.general_count,
    },
    {
      name: "card unlinked",
      list: { unlinked: true },
      rpc: { p_asset_type: null, p_status: null, p_location: null },
      pick: (s) => s.unlinked_qr_count,
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const listCount = await countAssets(supabase, c.list);
    const { data, error } = await supabase.rpc("get_dashboard_stats", c.rpc);
    if (error) throw error;
    const dash = c.pick(data);
    const ok = dash === listCount;
    console.log(`${ok ? "OK" : "FAIL"} ${c.name}: list=${listCount} dash=${dash}`);
    if (!ok) failed++;
  }

  if (failed) {
    console.error(`FAILED ${failed} case(s)`);
    process.exit(1);
  }
  console.log("PASS: dashboard counts match list filters");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
