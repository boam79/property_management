"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSafeRedirectPath } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 붙여넣기·자동완성으로 섞이는 앞뒤 공백 제거(이메일은 대소문자 무관하므로 소문자화).
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();

      const supabase = createClient();
      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (signError || !data.user) {
        setError(signError?.message ?? "로그인에 실패했습니다.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      let dest = "/assets";
      if (redirectTo && isSafeRedirectPath(redirectTo)) {
        dest = redirectTo;
      } else if (profile?.role === "ADMIN") {
        dest = "/admin";
      }

      router.replace(dest);
      router.refresh();
    } catch (err) {
      console.error("[login]", err);
      setError("로그인 중 오류가 발생했습니다. 환경 변수를 확인하세요.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
