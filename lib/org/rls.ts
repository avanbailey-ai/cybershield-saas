/**
 * RLS policy reference for enterprise multi-tenancy.
 * Applied via migration 20260614160000_enterprise_multi_tenant.sql
 *
 * organization_members:
 *   - org_members_select_own: users see rows where user_id = auth.uid()
 *   - org_members_select_org: members see all members in their orgs
 *
 * organizations:
 *   - orgs_select_member: members can SELECT orgs they belong to
 *
 * websites / scans / alerts:
 *   - *_select_org: user_id = auth.uid() OR org_id in user's memberships
 *   (legacy user_id rows remain accessible; org_id rows shared across team)
 *
 * audit_logs:
 *   - audit_logs_select_org: org members can read their org's audit trail
 *
 * org_invites:
 *   - org_invites_select: owner/admin can view pending invites
 *
 * Service-role (admin client) bypasses RLS for writes (webhooks, workers, migration).
 */

export const RLS_POLICY_VERSION = '20260614160000';
