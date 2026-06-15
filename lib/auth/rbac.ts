import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/auth/owner";
import { getUserProfile } from "@/lib/billing/planService";
import {
  hasPermission,
  type OrgRole,
  type Permission,
} from "@/lib/auth/orgRoles";

export type { OrgRole, Permission } from "@/lib/auth/orgRoles";
export { hasPermission, isOrgAdminRole } from "@/lib/auth/orgRoles";

export async function getUserOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data?.role) return null;
  return data.role as OrgRole;
}

export async function requirePermission(
  userId: string,
  orgId: string | null | undefined,
  permission: Permission,
  authEmail?: string | null,
): Promise<void> {
  if (authEmail && isOwner(authEmail)) return;

  const profile = await getUserProfile(userId);
  if (isOwner(profile.email)) return;

  if (!orgId) {
    const err = new Error("Forbidden: organization context required");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  const role = await getUserOrgRole(userId, orgId);
  if (!role || !hasPermission(role, permission)) {
    const err = new Error(`Forbidden: missing permission "${permission}"`);
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

/** Platform owner or org member with permission. */
export async function checkPermissionOrOwner(
  userId: string,
  orgId: string | null | undefined,
  permission: Permission,
): Promise<boolean> {
  const profile = await getUserProfile(userId);
  if (isOwner(profile.email)) return true;
  if (!orgId) return permission === "manage_websites" || permission === "run_scans";
  const role = await getUserOrgRole(userId, orgId);
  return role ? hasPermission(role, permission) : false;
}
