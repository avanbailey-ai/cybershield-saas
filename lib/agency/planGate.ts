import { canAccessAgencyDashboard, normalizePlan } from '@/lib/auth/permissions';
import { canAccessFeature, type UserForFeatureGate } from '@/lib/auth/featureGate';

export { canAccessAgencyDashboard };

export function isAgencyPlanUser(user: UserForFeatureGate): boolean {
  return normalizePlan(user.plan) === 'agency';
}

export function agencyFeatureBlockedMessage(feature: string): string {
  return `${feature} is available on the Agency plan ($299/mo). Upgrade to manage client portfolios and client-ready reports.`;
}

export function canUseAgencyClientFeatures(user: UserForFeatureGate): boolean {
  return (
    canAccessFeature(user, 'monitoring') &&
    isAgencyPlanUser(user) &&
    (user.subscription_status === 'active' || user.subscription_status === 'trialing')
  );
}
