/**
 * SSO foundation — structure only, not yet implemented.
 * Future: wire SAML/OIDC providers via Supabase Auth or external IdP.
 */

export type SSOProvider = 'saml' | 'google_workspace' | 'oidc';

export interface SSOConfig {
  provider: SSOProvider;
  enabled: boolean;
  entityId?: string;
  metadataUrl?: string;
  clientId?: string;
}

/** Placeholder — SSO not enabled in production yet. */
export function isSSOEnabled(): boolean {
  return false;
}

/** Placeholder for future org-level SSO config lookup. */
export function getSSOConfig(_orgId: string): SSOConfig | null {
  return null;
}
