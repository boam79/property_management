import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          QR 자산관리
        </h1>
        <p className="mt-2 text-sm text-zinc-600">로그인하여 계속하세요</p>
      </div>
      <LoginForm redirectTo={params.redirect} />
    </main>
  );
}
