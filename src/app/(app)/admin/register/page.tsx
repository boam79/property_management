import { requireAdmin } from "@/lib/auth";
import { ManualAssetRegisterForm } from "@/components/manual-asset-register-form";

export default async function AdminManualRegisterPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">자산 등록</h1>
        <p className="text-sm text-muted-foreground">
          PC에서 자산을 직접 등록하고, 새 QR을 만들어 바로 배정합니다.
        </p>
      </div>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <ManualAssetRegisterForm />
      </div>
    </div>
  );
}
