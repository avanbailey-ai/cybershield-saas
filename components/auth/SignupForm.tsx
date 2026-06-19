"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchPostAuthRedirectPath } from "@/lib/auth/fetchPostAuthRedirectPath";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import AuthProviderDivider from "@/components/auth/AuthProviderDivider";
import { isValidReferralCode } from "@/lib/referrals/codeFormat";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && isValidReferralCode(ref)) {
      void fetch("/api/referrals/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "click", code: ref }),
      });
    }

    const refParam = searchParams.get("ref");
    const refToken =
      refParam?.startsWith("prospect_") ? refParam.slice("prospect_".length) : null;
    const prospectToken = searchParams.get("prospect") ?? refToken;

    if (prospectToken && prospectToken.length >= 8) {
      sessionStorage.setItem("prospect_attribution_token", prospectToken);
      void fetch("/api/attribution/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: prospectToken }),
      });
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user && data.session) {
        try {
          // Always attempt capture: the server falls back to the durable
          // prospect cookie when sessionStorage is empty (reload/other device).
          const attributionToken = sessionStorage.getItem("prospect_attribution_token");
          await fetch("/api/attribution/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(attributionToken ? { token: attributionToken } : {}),
          });
          sessionStorage.removeItem("prospect_attribution_token");
        } catch {
          // Non-blocking
        }

        try {
          await fetch("/api/referrals/attach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
        } catch {
          // Non-blocking
        }

        try {
          await fetch("/api/user/ensure-org", { method: "POST", credentials: "include" });
        } catch {
          // Non-blocking
        }

        router.push(
          redirectTo && redirectTo.startsWith("/")
            ? redirectTo
            : await fetchPostAuthRedirectPath(),
        );
        router.refresh();
      } else {
        setMessage("Check your email to confirm your account before signing in.");
      }
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

  return (
    <div className="space-y-5">
      <GoogleAuthButton label="Sign up with Google" />

      <AuthProviderDivider />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-400">
            {message}
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

        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />

        <Input
          id="confirmPassword"
          type="password"
          label="Confirm password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Create Account
        </Button>

        <p className="text-center text-xs text-gray-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="text-gray-400 underline hover:text-gray-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-gray-400 underline hover:text-gray-300">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
