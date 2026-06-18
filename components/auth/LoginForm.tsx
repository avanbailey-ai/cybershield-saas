"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchPostAuthRedirectPath } from "@/lib/auth/fetchPostAuthRedirectPath";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import AuthProviderDivider from "@/components/auth/AuthProviderDivider";
import ForgotPasswordPanel from "@/components/auth/ForgotPasswordPanel";

interface LoginFormProps {
  defaultRedirectTo?: string;
}

export default function LoginForm({ defaultRedirectTo }: LoginFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? defaultRedirectTo;
  const authError = searchParams.get("error");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    authError === "auth_callback_failed"
      ? "Sign-in failed. Please try again."
      : authError === "auth_not_configured"
        ? "Authentication is not configured."
        : null,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push(
        redirectTo && redirectTo.startsWith("/")
          ? redirectTo
          : await fetchPostAuthRedirectPath(),
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (mode === "forgot") {
    return (
      <ForgotPasswordPanel
        initialEmail={email}
        onBack={() => setMode("login")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GoogleAuthButton label="Sign in with Google" />

      <AuthProviderDivider />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Input
          id="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-gray-400">
              Password
            </label>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Sign In
        </Button>
      </form>
    </div>
  );
}
