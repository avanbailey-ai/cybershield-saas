'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PROBLEM_TYPES, SEVERITY_LEVELS, type ProblemSeverity, type ProblemType } from '@/lib/beta/problemReports';

export interface ReportProblemContext {
  scanId?: string;
  websiteId?: string;
  reportId?: string;
}

interface ReportProblemWidgetProps {
  userEmail?: string | null;
  context?: ReportProblemContext;
}

function routeNameFromPath(pathname: string): string {
  if (pathname.startsWith('/report/')) return 'report';
  if (pathname.includes('/websites')) return 'websites';
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.startsWith('/enterprise/portal')) return 'enterprise-portal';
  if (pathname.startsWith('/scan')) return 'free-scan';
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/app')) return 'dashboard';
  return 'other';
}

function idsFromPath(pathname: string): ReportProblemContext {
  const reportMatch = pathname.match(/\/report\/([0-9a-f-]{36})/i);
  if (reportMatch) return { reportId: reportMatch[1] };
  return {};
}

export default function ReportProblemWidget({ userEmail, context }: ReportProblemWidgetProps) {
  const [open, setOpen] = useState(false);
  const [problemType, setProblemType] = useState<ProblemType>(PROBLEM_TYPES[0]);
  const [severity, setSeverity] = useState<ProblemSeverity>('Medium');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState(userEmail ?? '');
  const [canContact, setCanContact] = useState(Boolean(userEmail));
  const [includeDebugContext, setIncludeDebugContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  const pageUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [open]);

  const mergedContext = useMemo(() => {
    if (typeof window === 'undefined') return context ?? {};
    return { ...idsFromPath(window.location.pathname), ...context };
  }, [context, open]);

  useEffect(() => {
    if (userEmail) setContactEmail(userEmail);
  }, [userEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const resetForm = useCallback(() => {
    setProblemType(PROBLEM_TYPES[0]);
    setSeverity('Medium');
    setMessage('');
    setCanContact(Boolean(userEmail));
    setIncludeDebugContext(true);
    setFeedback(null);
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const lastError =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('cybershield:lastError') : null;

    try {
      const res = await fetch('/api/beta/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemType,
          severity,
          message,
          contactEmail: contactEmail.trim() || undefined,
          canContact,
          includeDebugContext,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          websiteId: mergedContext.websiteId,
          scanId: mergedContext.scanId,
          reportId: mergedContext.reportId,
          debugContext: {
            referrer: document.referrer || undefined,
            routeName: routeNameFromPath(window.location.pathname),
            lastError: lastError || undefined,
          },
        }),
      });

      if (!res.ok) {
        setFeedback('error');
        return;
      }

      setFeedback('success');
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1800);
    } catch {
      setFeedback('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex max-w-[11rem] flex-col items-start rounded-full border border-indigo-500/40 bg-indigo-600 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
        aria-label="Report a Problem"
      >
        <span>Report a Problem</span>
        <span className="text-[10px] font-normal text-indigo-100/90">Beta feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-problem-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="report-problem-title" className="text-lg font-semibold text-white">
                  Report a Problem
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Beta feedback helps us improve CyberShield.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {feedback === 'success' ? (
              <p className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                Thanks — your report was sent. We&apos;ll review it during beta testing.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-300">Problem type</span>
                  <select
                    value={problemType}
                    onChange={(e) => setProblemType(e.target.value as ProblemType)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    required
                  >
                    {PROBLEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-gray-300">Severity</span>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as ProblemSeverity)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                    required
                  >
                    {SEVERITY_LEVELS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'Low' && 'Low — minor issue'}
                        {s === 'Medium' && 'Medium — confusing or inconvenient'}
                        {s === 'High' && 'High — blocks workflow'}
                        {s === 'Critical' && 'Critical — prevents use'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-gray-300">What happened?</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you clicked, what you expected, and what happened instead."
                    rows={4}
                    maxLength={5000}
                    required
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-gray-300">What page were you on?</span>
                  <input
                    type="url"
                    readOnly
                    value={pageUrl}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-400"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-gray-300">Contact email</span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"
                  />
                </label>

                <label className="flex items-start gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={canContact}
                    onChange={(e) => setCanContact(e.target.checked)}
                    className="mt-1"
                  />
                  Yes, you can contact me about this issue.
                </label>

                <label className="flex items-start gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={includeDebugContext}
                    onChange={(e) => setIncludeDebugContext(e.target.checked)}
                    className="mt-1"
                  />
                  Include basic technical context like browser, page URL, timestamp, and user plan.
                  Never includes passwords or payment details.
                </label>

                {feedback === 'error' && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                    Couldn&apos;t send report. Please try again.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
