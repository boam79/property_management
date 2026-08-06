import { requireAdmin } from "@/lib/auth";
import { ImportWizard } from "@/components/import-wizard";

export default async function AdminImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">엑셀 임포트</h1>
        <p className="text-sm text-muted-foreground">
          템플릿 다운로드 → 업로드·검증 → 오류 없으면 전체 반영
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
