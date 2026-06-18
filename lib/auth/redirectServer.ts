import "server-only";

import { getSubscriptionAccessFromSession } from "@/lib/billing/getSubscriptionAccess";
import { getRedirectPath, type SessionSupabaseClient } from "@/lib/auth/redirect";
import { userFromSubscriptionAccess } from "@/lib/auth/enterpriseGateUser";

/** Server-only — resolves post-auth redirect using admin-backed org/subscription reads. */
export async function getRedirectPathForSession(
  supabase: SessionSupabaseClient,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login";

  const access = await getSubscriptionAccessFromSession(
    supabase,
    user.id,
    user.email,
  );

  return getRedirectPath(
    userFromSubscriptionAccess(access, user.email),
    access.orgRole,
  );
}
