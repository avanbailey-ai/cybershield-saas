'use client';

import { useEffect, useState } from 'react';

type CronRun = {
  id: string;
  started_at: string;
  completed_at: string | null;
  websites_considered: number;
  websites_due: number;
  websites_enqueued: number;
  websites_skipped: number;
  websites_blocked: number;
  websites_errors: number;
  batch_processed: number;
  batch_failed: number;
  emails_attempted: number;
  emails_sent: number;
  emails_skipped: number;
};

type EmailLog = {
  id: string;
  created_at: string;
  recipient: string;
  email_type: string;
  subject: string;
  status: string;
  skip_reason: string | null;
  severity_summary: string | null;
  website_ids: string[];
};

type Summary = {
  emailsLast24h: number;
  sentLast24h: number;
  skippedLast24h: number;
  failedLast24h: number;
};

type EmailBudget = {
  monthlyBudget: number;
  monthlySent: number;
  monthlyRemaining: number;
  dailySent: number;
  tier: string;
  budgetMonth: string;
};

export default function MonitoringLogsClient() {
  const [cronRuns, setCronRuns] = useState<CronRun[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [emailBudget, setEmailBudget] = useState<EmailBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/monitoring-logs?limit=40');
        if (!res.ok) throw new Error('Failed to load monitoring logs');
        const data = await res.json();
        setCronRuns(data.cronRuns ?? []);
        setEmailLogs(data.emailLogs ?? []);
        setSummary(data.summary ?? null);
        setEmailBudget(data.emailBudget ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading monitoring logs…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {emailBudget && (
        <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
            Email budget ({emailBudget.budgetMonth})
          </p>
          <p className="mt-2 text-lg font-bold text-white">
            {emailBudget.monthlySent} / {emailBudget.monthlyBudget} sent
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({emailBudget.monthlyRemaining} remaining · tier: {emailBudget.tier})
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">Daily sent: {emailBudget.dailySent}</p>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Emails (24h)', value: summary.emailsLast24h },
            { label: 'Sent (24h)', value: summary.sentLast24h },
            { label: 'Skipped (24h)', value: summary.skippedLast24h },
            { label: 'Failed (24h)', value: summary.failedLast24h },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Recent cron runs</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="pb-2 pr-4 font-medium">Started</th>
                <th className="pb-2 pr-4 font-medium">Due</th>
                <th className="pb-2 pr-4 font-medium">Enqueued</th>
                <th className="pb-2 pr-4 font-medium">Processed</th>
                <th className="pb-2 pr-4 font-medium">Emails sent</th>
                <th className="pb-2 font-medium">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {cronRuns.map((run) => (
                <tr key={run.id} className="border-b border-gray-800/60 text-gray-300">
                  <td className="py-2 pr-4">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{run.websites_due}</td>
                  <td className="py-2 pr-4">{run.websites_enqueued}</td>
                  <td className="py-2 pr-4">{run.batch_processed}</td>
                  <td className="py-2 pr-4 text-emerald-400">{run.emails_sent}</td>
                  <td className="py-2">{run.websites_skipped}</td>
                </tr>
              ))}
              {cronRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-gray-500">
                    No cron runs logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Recent email alerts</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Subject</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Sites</th>
              </tr>
            </thead>
            <tbody>
              {emailLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/60 text-gray-300">
                  <td className="py-2 pr-4">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{log.email_type}</td>
                  <td className="py-2 pr-4 max-w-xs truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        log.status === 'sent'
                          ? 'text-emerald-400'
                          : log.status === 'skipped'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {log.status}
                    </span>
                    {log.skip_reason && (
                      <span className="ml-1 text-xs text-gray-500">({log.skip_reason})</span>
                    )}
                  </td>
                  <td className="py-2">{log.website_ids?.length ?? 0}</td>
                </tr>
              ))}
              {emailLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500">
                    No email alerts logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
