/**
 * Verify QA plan resolution does not auto-grant enterprise portal.
 * Run: npx tsx scripts/verify-qa-plan-resolution.ts
 */

import { getEffectivePlan, canAccessEnterprise } from '../lib/auth/permissions';
import { getRedirectPath } from '../lib/auth/redirect';
import { isOwner } from '../lib/auth/owner';
import { canAccessFeature } from '../lib/auth/featureGate';
import { qaAccountFlagsFromProfile } from '../lib/auth/qaAccount';
import { userFromSubscriptionAccess } from '../lib/auth/enterpriseGateUser';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const qaPro = {
  isQaAccount: true as const,
  qaSimulatedPlan: 'pro' as const,
  qaEnterpriseEnabled: false,
  plan: 'pro',
  subscription_status: 'active',
};

assert(getEffectivePlan(qaPro) === 'pro', 'QA Pro effective plan');
assert(
  canAccessFeature(qaPro, 'monitoring'),
  'QA Pro monitoring',
);

const qaGrowth = { ...qaPro, qaSimulatedPlan: 'growth' as const, plan: 'growth' };
assert(getEffectivePlan(qaGrowth) === 'growth', 'QA Growth effective plan');

const qaAgency = { ...qaPro, qaSimulatedPlan: 'agency' as const, plan: 'agency' };
assert(getEffectivePlan(qaAgency) === 'agency', 'QA Agency effective plan');

assert(
  !canAccessEnterprise(qaAgency, 'owner'),
  'QA Agency must NOT access enterprise portal by default',
);

assert(
  getRedirectPath(qaAgency, 'owner') === '/app',
  'QA Agency redirect goes to standard dashboard',
);

const qaAgencyEnterprise = { ...qaAgency, qaEnterpriseEnabled: true };
assert(
  canAccessEnterprise(qaAgencyEnterprise, 'owner'),
  'QA Agency with enterprise flag can access portal',
);
assert(
  getRedirectPath(qaAgencyEnterprise, 'owner') === '/enterprise/portal',
  'QA Agency enterprise flag redirects to portal',
);

const flags = qaAccountFlagsFromProfile({
  is_qa_account: true,
  qa_simulated_plan: 'agency',
  qa_enterprise_enabled: false,
});
assert(!flags.qaEnterpriseEnabled, 'profile flags enterprise off by default');

const access = {
  plan: flags.qaSimulatedPlan,
  status: 'active',
  isActive: true,
  canAccessDashboard: true,
  isQaAccount: true,
  qaSimulatedPlan: flags.qaSimulatedPlan,
  qaEnterpriseEnabled: flags.qaEnterpriseEnabled,
};
const gateUser = userFromSubscriptionAccess(access, 'test@gmail.com');
assert(
  !canAccessEnterprise(gateUser, 'owner'),
  'subscription access pipeline blocks QA enterprise',
);

const paidAgency = {
  plan: 'agency',
  subscription_status: 'active',
};
assert(
  canAccessEnterprise(paidAgency, 'owner'),
  'normal paid agency still gets enterprise',
);
assert(!isOwner('test@gmail.com'), 'QA email is not platform owner');
assert(isOwner('avanbailey@gmail.com'), 'owner override unchanged');

console.log('All QA plan resolution checks passed.');
