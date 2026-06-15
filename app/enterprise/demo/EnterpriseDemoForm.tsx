'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';

export default function EnterpriseDemoForm() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead_id') ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enterprise/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId || undefined,
          name: name || undefined,
          email,
          scheduled_time: scheduledTime,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to book demo');
        return;
      }

      setConfirmed(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <EnterpriseHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8">
            <h1 className="text-2xl font-bold text-white">Demo Scheduled</h1>
            <p className="mt-3 text-gray-300">
              Confirmation sent to {email}. Our security team will meet you at the scheduled time.
            </p>
            <Link href="/enterprise/pricing" className="mt-6 inline-block text-blue-400 hover:text-blue-300">
              View enterprise pricing →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <EnterpriseHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Book a Security Demo</h1>
          <p className="mt-2 text-gray-400">
            30-minute walkthrough of CyberShield enterprise capabilities.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-dashed border-gray-700 bg-gray-900/30 p-6 text-center">
          <p className="text-sm text-gray-400">
            Prefer Calendly? Embed placeholder — use the form below to schedule directly.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {/* Calendly embed: data-url="https://calendly.com/your-team/security-demo" */}
            External scheduling integration available on request.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="demo-name" className="mb-1 block text-sm font-medium text-gray-300">
                Name
              </label>
              <input
                id="demo-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="demo-email" className="mb-1 block text-sm font-medium text-gray-300">
                Email *
              </label>
              <input
                id="demo-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="scheduled-time" className="mb-1 block text-sm font-medium text-gray-300">
              Preferred Date & Time *
            </label>
            <input
              id="scheduled-time"
              type="datetime-local"
              required
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="demo-notes" className="mb-1 block text-sm font-medium text-gray-300">
              Notes (optional)
            </label>
            <textarea
              id="demo-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics you'd like to cover..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Booking...' : 'Schedule Demo'}
          </button>
        </form>
      </main>
    </div>
  );
}
