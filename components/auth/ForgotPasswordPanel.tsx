'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authCallbackUrl, RESET_PASSWORD_PATH } from '@/lib/auth/clientRedirect';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface ForgotPasswordPanelProps {
  initialEmail?: string;
  onBack: () => void;
}

export default function ForgotPasswordPanel({ initialEmail = '', onBack }: ForgotPasswordPanelProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authCallbackUrl(RESET_PASSWORD_PATH),
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-400">
          Check your email for a password reset link. It expires after a short time for security.
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-gray-400">
        Enter your account email and we&apos;ll send a link to reset your password.
      </p>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Input
        id="reset-email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Send reset link
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm font-medium text-gray-400 hover:text-gray-300"
      >
        ← Back to sign in
      </button>
    </form>
  );
}
