'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface ChangePasswordCardProps {
  canChangePassword: boolean;
  usesGoogle: boolean;
}

export default function ChangePasswordCard({
  canChangePassword,
  usesGoogle,
}: ChangePasswordCardProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!canChangePassword) {
    return (
      <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-4 py-3 text-sm text-gray-400">
        {usesGoogle
          ? 'You sign in with Google. Password changes are managed through your Google account.'
          : 'Password change is not available for this account type.'}
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });

      if (authError) {
        setError(authError.message);
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-400">
          Your password has been updated.
        </div>
      )}

      <Input
        id="settings-new-password"
        type="password"
        label="New password"
        placeholder="Minimum 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />

      <Input
        id="settings-confirm-password"
        type="password"
        label="Confirm new password"
        placeholder="••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      <Button type="submit" variant="secondary" size="md" loading={loading}>
        Change password
      </Button>
    </form>
  );
}
