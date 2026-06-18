/**
 * Verify QA customer simulation helpers.
 * Run: npx tsx scripts/verify-qa-account-mode.ts
 */

import { canAccessFeature } from '../lib/auth/featureGate';
import { getEffectivePlan, canAddWebsite, canAccessEnterprise } from '../lib/auth/permissions';
import {
  applyQaPlanOverride,
  parseQaSimulatedPlan,
  qaAccountFlagsFromProfile,
} from '../lib/auth/qaAccount';
import { gateReport } from '../lib/accessControl';
import type { SubscriptionAccess } from '../lib/billing/getSubscriptionAccess';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(parseQaSimulatedPlan('growth') === 'growth', 'parse growth');
assert(parseQaSimulatedPlan('invalid') === 'agency', 'invalid defaults agency');

const qaFlags = qaAccountFlagsFromProfile({
  is_qa_account: true,
  qa_simulated_plan: 'pro',
});
assert(qaFlags.isQaAccount && qaFlags.qaSimulatedPlan === 'pro', 'flags from profile');

const qaUser = applyQaPlanOverride(
  { plan: 'free', subscription_status: 'inactive' },
  qaFlags,
);
assert(qaUser.plan === 'pro' && qaUser.subscription_status === 'active', 'plan override');

const effectivePro = getEffectivePlan({ isQaAccount: true, qaSimulatedPlan: 'pro', plan: 'free' });
assert(effectivePro === 'pro', 'effective plan pro');

assert(
  canAccessFeature(
    { plan: 'pro', subscription_status: 'active', isQaAccount: true },
    'monitoring',
  ),
  'QA pro monitoring',
);

assert(
  !canAccessFeature(
    { plan: 'pro', subscription_status: 'active', isQaAccount: true },
    'team',
  ),
  'QA pro no team',
);

assert(
  canAccessFeature(
    { plan: 'agency', subscription_status: 'active', isQaAccount: true, orgRole: 'owner' },
    'team',
  ),
  'QA agency team',
);

const websiteLimit = canAddWebsite({ isQaAccount: true, qaSimulatedPlan: 'pro', plan: 'pro' }, 10);
assert(!websiteLimit.allowed, 'pro website limit enforced for QA at cap');

const enterpriseBlocked = canAccessEnterprise(
  { plan: 'agency', subscription_status: 'active', isQaAccount: true, qaEnterpriseEnabled: false },
  'owner',
);
assert(!enterpriseBlocked, 'QA agency blocks enterprise without flag');

const enterpriseAllowed = canAccessEnterprise(
  { plan: 'agency', subscription_status: 'active', isQaAccount: true, qaEnterpriseEnabled: true },
  'owner',
);
assert(enterpriseAllowed, 'QA agency enterprise when flag enabled');

const access: SubscriptionAccess = qaFlags.isQaAccount
  ? {
      plan: 'growth',
      status: 'active',
      isActive: true,
      canAccessDashboard: true,
    }
  : { plan: 'free', status: 'inactive', isActive: false, canAccessDashboard: true };
assert(access.plan === 'growth' && access.isActive, 'subscription access override shape');

const report = gateReport(50, 'pro', 'test@gmail.com', 'active', true);
assert(report.canViewFull, 'QA full report');

console.log('All QA account mode checks passed.');
