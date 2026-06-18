import type { UserForFeatureGate } from '@/lib/auth/featureGate';
import type { SubscriptionAccess } from '@/lib/billing/getSubscriptionAccess';

/** Build user object for canAccessEnterprise / getRedirectPath from resolved access. */
export function userFromSubscriptionAccess(
  access: Pick<
    SubscriptionAccess,
    'plan' | 'status' | 'isQaAccount' | 'qaSimulatedPlan' | 'qaEnterpriseEnabled'
  >,
  email?: string | null,
): UserForFeatureGate {
  return {
    email,
    plan: access.plan,
    subscription_status: access.status,
    isQaAccount: access.isQaAccount,
    qaSimulatedPlan: access.qaSimulatedPlan,
    qaEnterpriseEnabled: access.qaEnterpriseEnabled,
  };
}
