import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign In — CyberShield Cloud",
  description: "Sign in to your CyberShield Cloud account.",
  path: "/login",
  noIndex: true,
});

const bullets = [
  "Health Center for every website",
  "SSL & domain expiry monitoring",
  "Change timeline & email alerts",
  "Daily to hourly monitoring (by plan)",
];

export default function LoginPage() {
  if (!isSupabaseAuthConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/40 px-6 py-4 text-sm text-yellow-400">
          Authentication is not configured. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your CyberShield account."
      footerText="Don't have an account?"
      footerLinkText="Create one free"
      footerLinkHref="/signup"
      secondaryFooterText="Enterprise customer?"
      secondaryFooterLinkText="Enterprise sign in"
      secondaryFooterLinkHref="/enterprise/login"
      panelHeadline="Welcome Back"
      panelDescription="Access your security monitoring dashboard and stay ahead of threats."
      panelBullets={bullets}
    >
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
