import type { UserIdentity } from '@supabase/supabase-js';

export function getAuthProviders(identities: UserIdentity[] | undefined): string[] {
  return identities?.map((i) => i.provider) ?? [];
}

/** User signed up with email/password (may also have Google linked). */
export function userCanChangePassword(identities: UserIdentity[] | undefined): boolean {
  const providers = getAuthProviders(identities);
  if (providers.length === 0) return true;
  return providers.includes('email');
}

export function userUsesGoogleSignIn(identities: UserIdentity[] | undefined): boolean {
  return getAuthProviders(identities).includes('google');
}
