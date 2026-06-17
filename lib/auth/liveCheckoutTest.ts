import { isOwner } from '@/lib/auth/owner';

export const LIVE_CHECKOUT_TEST_EMAIL_RE =
  /^avanbailey\+live-checkout-test-\d+@gmail\.com$/i;

export function isLiveCheckoutTestEmail(email: string | null | undefined): boolean {
  return !!email && LIVE_CHECKOUT_TEST_EMAIL_RE.test(email);
}

export function canUseLiveCheckoutTest(email: string | null | undefined): boolean {
  return isOwner(email) || isLiveCheckoutTestEmail(email);
}
