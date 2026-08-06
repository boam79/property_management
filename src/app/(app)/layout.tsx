import { requireAuth } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

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
