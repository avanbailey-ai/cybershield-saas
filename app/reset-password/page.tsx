import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseAuthConfigured } from '@/lib/supabase/env';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Reset Password — CyberShield Cloud',
  description: 'Reset your CyberShield Cloud account password.',
  path: '/reset-password',
  noIndex: true,
});

export default async function ResetPasswordPage() {
  if (!isSupabaseAuthConfigured()) {
    redirect('/login?error=auth_not_configured');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=auth_callback_failed');
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password for your CyberShield account."
      footerText="Remember your password?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
      panelHeadline="Secure Your Account"
      panelDescription="Use at least 8 characters. Avoid reusing passwords from other sites."
      panelBullets={[
        'Health Center for every website',
        'SSL & domain expiry monitoring',
        'Change timeline & email alerts',
      ]}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
