import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { maskDomain } from '@/lib/leaderboard/update';
import { maskUserId } from '@/lib/referrals/code';

export const metadata: Metadata = {
  title: 'Security Leaderboard — Top Websites & Referrers',
  description:
    'See the most secure websites, top referrers, and most shared scans on CyberShield. Scan your site for free.',
  openGraph: {
    title: 'CyberShield Security Leaderboard',
    description: 'Top secure websites, viral referrers, and most shared scans.',
  },
};

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = createAdminClient();

  const [
    { data: topSecure },
    { data: mostImproved },
    { data: topReferrers },
    { data: sharedEvents },
  ] = await Promise.all([
    supabase
      .from('leaderboard_entries')
      .select('domain, best_score, scan_count, last_scanned_at')
      .order('best_score', { ascending: false })
      .limit(20),
    supabase
      .from('leaderboard_entries')
      .select('domain, best_score, improvement_delta, scan_count, last_scanned_at')
      .gt('improvement_delta', 0)
      .order('improvement_delta', { ascending: false })
      .limit(20),
    supabase
      .from('profiles')
      .select('id, viral_score')
      .gt('viral_score', 0)
      .order('viral_score', { ascending: false })
      .limit(20),
    supabase
      .from('viral_events')
      .select('metadata')
      .eq('event_type', 'scan_shared')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const shareCounts = new Map<string, number>();
  for (const event of sharedEvents ?? []) {
    const meta = event.metadata as { domain?: string; shareToken?: string } | null;
    const key = meta?.shareToken ?? meta?.domain ?? 'unknown';
    shareCounts.set(key, (shareCounts.get(key) ?? 0) + 1);
  }

  const mostShared = [...shareCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, count]) => ({ key, count }));

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">CyberShield</span>
          </Link>
          <Link
            href="/scan"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Scan Your Site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Security Leaderboard</h1>
          <p className="mt-3 text-gray-400">
            Top domains, viral referrers, and most shared scans. Identities are masked for privacy.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Top Secure Websites</h2>
            {topSecure && topSecure.length > 0 ? (
              <ol className="space-y-3">
                {topSecure.map((entry, i) => (
                  <li
                    key={entry.domain}
                    className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">{maskDomain(entry.domain)}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">{entry.best_score}/100</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No scans yet. Be the first!</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Most Improved</h2>
            {mostImproved && mostImproved.length > 0 ? (
              <ol className="space-y-3">
                {mostImproved.map((entry, i) => (
                  <li
                    key={entry.domain}
                    className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-xs font-bold text-green-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">{maskDomain(entry.domain)}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-400">+{entry.improvement_delta} pts</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No improvements recorded yet.</p>
            )}
          </section>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Top Referrers</h2>
            {topReferrers && topReferrers.length > 0 ? (
              <ol className="space-y-3">
                {topReferrers.map((entry, i) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600/20 text-xs font-bold text-purple-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">{maskUserId(entry.id)}</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-400">{entry.viral_score} pts</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No referrers yet. Share your link from the dashboard!</p>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Most Shared Scans</h2>
            {mostShared.length > 0 ? (
              <ol className="space-y-3">
                {mostShared.map((entry, i) => (
                  <li
                    key={entry.key}
                    className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600/20 text-xs font-bold text-cyan-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">
                        {entry.key.startsWith('http') || entry.key.includes('.')
                          ? maskDomain(entry.key)
                          : `Scan ${entry.key.slice(0, 8)}…`}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-cyan-400">{entry.count} shares</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No shared scans yet.</p>
            )}
          </section>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/scan"
            className="inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Scan Your Website Free →
          </Link>
        </div>
      </main>
    </div>
  );
}
