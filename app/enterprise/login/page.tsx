import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import LoginForm from '@/components/auth/LoginForm';
import { isSupabaseAuthConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Enterprise Sign In',
};

const bullets = [
  'Organization-wide security visibility',
  'Team member access controls',
  'Centralized scan reporting',
  'Enterprise SLA support',
];

export default function EnterpriseLoginPage() {
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
      title="Enterprise sign in"
      subtitle="Access your organization security portal."
      footerText="Need a team account?"
      footerLinkText="Contact sales"
      footerLinkHref="/enterprise/lead"
      panelHeadline="Enterprise Portal"
      panelDescription="Monitor security posture across your organization from a dedicated enterprise workspace."
      panelBullets={bullets}
    >
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <LoginForm defaultRedirectTo="/enterprise/portal" />
      </Suspense>
    </AuthCard>
  );
}
