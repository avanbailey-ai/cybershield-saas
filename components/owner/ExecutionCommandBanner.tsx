'use client';

import { useFounderNav } from './FounderNavContext';

export default function ExecutionCommandBanner({
  pendingApprovals,
  emailsSent24h,
  followUpsDue,
  busy,
  onApproveAll,
}: {
  pendingApprovals: number;
  emailsSent24h: number;
  followUpsDue: number;
  busy?: boolean;
  onApproveAll: () => void;
}) {
  const { setSection } = useFounderNav();

  if (pendingApprovals === 0 && followUpsDue === 0 && emailsSent24h === 0) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.03] to-transparent p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          CyberShield Autopilot
        </p>
        <p className="mt-2 text-lg font-medium text-white">Standing by — no approvals pending</p>
        <p className="mt-1 text-sm text-gray-500">
          Run discovery or check Prospects to feed the send queue.
        </p>
        <button
          type="button"
          onClick={() => setSection('prospects')}
          className="mt-4 text-sm text-violet-400 hover:text-violet-300"
        >
          Open prospect pipeline →
        </button>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-violet-900/10 to-transparent p-6 shadow-lg shadow-violet-950/40">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">
            CyberShield Autopilot — action required
          </p>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {pendingApprovals > 0
            ? `${pendingApprovals} outreach email${pendingApprovals === 1 ? '' : 's'} ready to send`
            : `${followUpsDue} follow-up${followUpsDue === 1 ? '' : 's'} due`}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-violet-100/80">
          Review drafts, click Approve &amp; Send, and CyberShield sends through your verified Resend
          domain. Follow-ups schedule automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {pendingApprovals > 0 && (
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-violet-200">
              {pendingApprovals} pending approval
            </span>
          )}
          {emailsSent24h > 0 && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              {emailsSent24h} sent (24h)
            </span>
          )}
          {followUpsDue > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
              {followUpsDue} follow-up{followUpsDue === 1 ? '' : 's'} due
            </span>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {pendingApprovals > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onApproveAll}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-50"
            >
              Approve all &amp; send ({pendingApprovals})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSection('inbox')}
            className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
          >
            Open inbox →
          </button>
          <button
            type="button"
            onClick={() => setSection('prospects')}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-white/5"
          >
            Send queue →
          </button>
        </div>
      </div>
    </section>
  );
}
