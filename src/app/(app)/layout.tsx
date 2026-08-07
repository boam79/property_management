import { requireAuth } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

/** Auth/cookies 의존 — 빌드 시 정적 프리렌더 방지 */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <AppNav role={profile.role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
