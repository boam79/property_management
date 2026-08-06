import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LinkQrForm } from "@/components/link-qr-form";

export default async function LinkQrPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: assets }, { data: qrs }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, asset_no, name")
      .is("qr_code_id", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("qr_codes")
      .select("id, display_code, token")
      .eq("status", "unused")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">QR 연결</h1>
        <p className="text-sm text-muted-foreground">
          QR 미연결 자산과 unused QR을 연결합니다.
        </p>
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <LinkQrForm
          assets={(assets ?? []).map((a) => ({
            id: a.id as string,
            label: `${a.asset_no} — ${a.name}`,
          }))}
          qrs={(qrs ?? []).map((q) => ({
            id: q.id as string,
            label: `${q.display_code} (${String(q.token).slice(0, 8)}…)`,
          }))}
        />
      </div>
    </div>
  );
}
