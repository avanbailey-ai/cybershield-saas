'use client';

import { useState } from 'react';
import { canUseLiveCheckoutTest } from '@/lib/auth/liveCheckoutTest';
import { isOwner } from '@/lib/auth/owner';

interface LiveCheckoutTestToolsProps {
  userEmail: string;
}

interface CreatedAccount {
  email: string;
  password: string;
  userId: string;
  orgId: string;
}

export default function LiveCheckoutTestTools({ userEmail }: LiveCheckoutTestToolsProps) {
  const showTools = canUseLiveCheckoutTest(userEmail);
  const ownerView = isOwner(userEmail);

  const [creating, setCreating] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);

  if (!showTools) {
    return null;
  }

  async function handleCreateAccount() {
    setCreating(true);
    setError(null);
    setCreatedAccount(null);
    try {
      const res = await fetch('/api/owner/create-live-test-account', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create test account');
        return;
      }
      setCreatedAccount({
        email: data.email,
        password: data.password,
        userId: data.userId,
        orgId: data.orgId,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleLiveCheckout() {
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout-live-test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details ? `${data.error}: ${data.details}` : (data.error ?? 'Checkout failed'));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-amber-200/80">
        Internal live Stripe checkout tooling — owner and designated test accounts only.
      </p>

      {ownerView && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCreateAccount}
            disabled={creating}
            className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-60"
          >
            {creating ? 'Creating account…' : 'Create Live Test Account'}
          </button>

          {createdAccount && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-100">
              <p className="font-semibold text-amber-50">Test account created</p>
              <p className="mt-2">
                <span className="text-amber-300">Email:</span> {createdAccount.email}
              </p>
              <p className="mt-1">
                <span className="text-amber-300">Password:</span>{' '}
                <code className="rounded bg-black/30 px-1 py-0.5">{createdAccount.password}</code>
              </p>
              <p className="mt-1 text-amber-200/70">
                Sign out, sign in as this user, then run the $1 checkout test below.
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleLiveCheckout}
        disabled={checkingOut}
        className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-60"
      >
        {checkingOut ? 'Opening Stripe…' : 'Run $1 Live Checkout Test'}
      </button>

      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
