/** Resend sandbox — only delivers to your Resend account email. */
export const RESEND_SANDBOX_FROM = 'CyberShield <alerts@resend.dev>';

/** Set EMAIL_FROM in production after verifying your domain in Resend. */
export const RESEND_PRODUCTION_FROM_DEFAULT = 'CyberShield <alerts@cybershieldcloud.com>';

export function getResendFromAddress(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;

  if (process.env.VERCEL_ENV === 'production') {
    return RESEND_PRODUCTION_FROM_DEFAULT;
  }

  return RESEND_SANDBOX_FROM;
}

export function isResendSandboxFrom(from?: string): boolean {
  return (from ?? getResendFromAddress()).includes('@resend.dev');
}
