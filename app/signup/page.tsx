import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account",
};

const bullets = [
  "Health Center for every website",
  "SSL & domain expiry monitoring",
  "Change timeline & email alerts",
  "Daily to hourly monitoring (by plan)",
];

export default function SignupPage() {
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
      title="Create your account"
      subtitle="Start with a free scan or set up continuous monitoring."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
      panelHeadline="Start Protecting Your Websites"
      panelDescription="Create your account, then scan your first site in under 30 seconds."
      panelBullets={bullets}
    >
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
