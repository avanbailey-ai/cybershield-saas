import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import { parseSignupAttributionParams, signupPlanCopy } from "@/lib/conversion/signupPlanContext";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseAuthConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/40 px-6 py-4 text-sm text-yellow-400">
          Authentication is not configured. Please contact support.
        </div>
      </div>
    );
  }

  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    } else if (value != null) {
      sp.set(key, value);
    }
  }

  const attribution = parseSignupAttributionParams(sp);
  const copy = signupPlanCopy(attribution.plan);

  return (
    <AuthCard
      title={copy.title}
      subtitle={copy.subtitle}
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
      panelHeadline={copy.panelHeadline}
      panelDescription={copy.panelDescription}
      panelBullets={copy.panelBullets}
    >
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <SignupForm
          initialPlan={attribution.plan}
          planBadge={copy.planBadge}
          planHighlight={copy.planHighlight}
          hasValidProspect={attribution.hasValidProspect}
        />
      </Suspense>
    </AuthCard>
  );
}
