import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
};

const bullets = [
  "Continuous 24/7 monitoring",
  "Real-time threat alerts",
  "Security scoring & reports",
  "SSL certificate monitoring",
];

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start protecting your web assets today."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
      panelHeadline="Start Protecting Your Websites"
      panelDescription="Create your account, then choose a plan to unlock the monitoring dashboard."
      panelBullets={bullets}
    >
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
