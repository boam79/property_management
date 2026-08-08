import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATION_FILES = [
  "20260807090000_drop_asset_photos.sql",
  "20260808010000_add_medical_asset_type.sql",
  "20260808020000_unused_qr_select_hardening.sql",
] as const;

const DB_URL_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
  "DB_URL",
] as const;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function envPresence() {
  const keys = Object.keys(process.env).sort();
  return {
    allCount: keys.length,
    interesting: keys.filter((k) =>
      /SUPABASE|POSTGRES|DATABASE|DB_|MIGRATE|SERVICE_ROLE|DIRECT/i.test(k)
    ),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN),
    dbUrlKeysPresent: DB_URL_KEYS.filter((k) => Boolean(process.env[k])),
  };
}

function resolveDbUrl(): string | null {
  for (const key of DB_URL_KEYS) {
    const v = process.env[key];
    if (v && /^postgres(ql)?:\/\//i.test(v)) return v;
  }
  return null;
}

async function runSql(dbUrl: string, sql: string) {
  // Dynamic import so local builds without pg still typecheck if skipped;
  // production deploy includes pg in package.json.
  const pg = await import("pg");
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function loadMigrationSql(name: string) {
  const filePath = path.join(process.cwd(), "supabase", "migrations", name);
  return readFile(filePath, "utf8");
}

async function tryManagementApiSql(sql: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref =
    process.env.SUPABASE_PROJECT_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
      /^https:\/\/([a-z0-9]+)\.supabase\.co/i
    )?.[1];
  if (!token || !ref) {
    return { ok: false as const, error: "missing_access_token_or_ref" };
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false as const,
      error: "management_api_failed",
      status: res.status,
      body: text.slice(0, 500),
    };
  }
  return { ok: true as const, body: text.slice(0, 200) };
}

export async function GET(request: Request) {
  const secret = process.env.MIGRATE_OPS_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return unauthorized();
  return NextResponse.json({ ok: true, probe: envPresence() });
}

export async function POST(request: Request) {
  const secret = process.env.MIGRATE_OPS_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return unauthorized();

  const probe = envPresence();
  const dbUrl = resolveDbUrl();
  const results: Array<Record<string, unknown>> = [];

  for (const name of MIGRATION_FILES) {
    let sql: string;
    try {
      sql = await loadMigrationSql(name);
    } catch (e) {
      results.push({
        name,
        ok: false,
        error: "read_failed",
        detail: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (dbUrl) {
      try {
        await runSql(dbUrl, sql);
        results.push({ name, ok: true, via: "pg" });
        continue;
      } catch (e) {
        results.push({
          name,
          ok: false,
          via: "pg",
          error: e instanceof Error ? e.message : String(e),
        });
        // fall through to management API for this file
      }
    }

    const mgmt = await tryManagementApiSql(sql);
    results.push({ name, via: "management_api", ...mgmt });
  }

  const allOk = results.every((r) => r.ok === true);
  return NextResponse.json(
    {
      ok: allOk,
      probe,
      usedDbUrl: Boolean(dbUrl),
      results,
    },
    { status: allOk ? 200 : 500 }
  );
}
