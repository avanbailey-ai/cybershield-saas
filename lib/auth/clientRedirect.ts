/** Client-side auth redirect URLs (must match Supabase redirect allowlist). */

export function authCallbackUrl(nextPath?: string): string {
  const base = `${window.location.origin}/auth/callback`;
  if (nextPath && nextPath.startsWith('/')) {
    return `${base}?next=${encodeURIComponent(nextPath)}`;
  }
  return base;
}

export const RESET_PASSWORD_PATH = '/reset-password';
