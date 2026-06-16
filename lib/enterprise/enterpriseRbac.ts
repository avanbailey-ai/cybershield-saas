import { NextResponse } from 'next/server';
import { isOrgAdminRole } from '@/lib/auth/rbac';
import type { OrgRole } from '@/lib/auth/rbac';

/** Deny viewers and non-admin org roles for enterprise admin endpoints. */
export function denyEnterpriseAdminAccess(
  orgId: string,
  role: OrgRole,
  endpoint: string,
): NextResponse | null {
  if (role === 'viewer' || !isOrgAdminRole(role)) {
    console.log('[rbac_denied_access]', { orgId, role, endpoint });
    return NextResponse.json(
      { error: 'Forbidden: only organization owners and admins may access this resource' },
      { status: 403 },
    );
  }
  return null;
}
