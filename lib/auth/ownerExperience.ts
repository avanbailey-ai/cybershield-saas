import { isOwner } from '@/lib/auth/owner';

/** Post-login home for the platform owner (Founder OS). */
export const OWNER_HOME_PATH = '/dashboard/admin/owner';

/** Paths the owner may access without being redirected to Founder OS. */
export function isOwnerExperiencePath(pathname: string): boolean {
  if (pathname === OWNER_HOME_PATH || pathname.startsWith(`${OWNER_HOME_PATH}/`)) {
    return true;
  }
  if (pathname.startsWith('/api/owner')) return true;
  if (pathname.startsWith('/api/admin')) return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname === '/reset-password') return true;
  // Owner may change password / billing on customer settings without leaving Founder OS loop.
  if (pathname === '/app/settings' || pathname.startsWith('/app/settings/')) return true;
  return false;
}

/** Customer / agency surfaces owners should not use while signed in. */
export function shouldRedirectOwnerFromPath(pathname: string): boolean {
  if (isOwnerExperiencePath(pathname)) return false;
  if (pathname.startsWith('/_next')) return false;
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/owner')) {
    // Allow other APIs (e.g. logout, scan triggers from founder tools)
    return false;
  }

  return (
    pathname.startsWith('/enterprise/portal') ||
    pathname.startsWith('/enterprise/onboarding') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/app') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/report/')
  );
}

export function ownerHomeForEmail(email: string | null | undefined): string | null {
  return isOwner(email) ? OWNER_HOME_PATH : null;
}
