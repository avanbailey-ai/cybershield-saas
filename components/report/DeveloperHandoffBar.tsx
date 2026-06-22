'use client';

import { useCallback, useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import {
  buildCombinedDeveloperEmailPayload,
  buildCombinedHandoffExportText,
  buildCombinedTicketPayload,
  type CombinedHandoffContext,
  type FindingActionContext,
  type ReportHandoffMeta,
} from '@/lib/findings';

interface DeveloperHandoffBarProps {
  findings: SecurityFinding[];
  actionContext: FindingActionContext;
  handoff: ReportHandoffMeta;
  priorityFindingIds?: string[];
  className?: string;
}

export default function DeveloperHandoffBar({
  findings,
  actionContext,
  handoff,
  priorityFindingIds = [],
  className = '',
}: DeveloperHandoffBarProps) {
  const [copied, setCopied] = useState<'email' | 'ticket' | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  const ctx: CombinedHandoffContext = useMemo(
    () => ({ ...actionContext, handoff }),
    [actionContext, handoff],
  );

  const developerEmail = useMemo(
    () => buildCombinedDeveloperEmailPayload(findings, ctx, priorityFindingIds),
    [findings, ctx, priorityFindingIds],
  );

  const ticket = useMemo(
    () => buildCombinedTicketPayload(findings, ctx, priorityFindingIds),
    [findings, ctx, priorityFindingIds],
  );

  const copyEmail = useCallback(async () => {
    const text = buildCombinedHandoffExportText(findings, ctx, priorityFindingIds);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('email');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      await navigator.clipboard.writeText(developerEmail.body);
      setCopied('email');
      window.setTimeout(() => setCopied(null), 2000);
    }
  }, [findings, ctx, priorityFindingIds, developerEmail.body]);

  const copyTicket = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ticket.body);
      setCopied('ticket');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setTicketOpen(true);
    }
  }, [ticket.body]);

  if (findings.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-gray-900 p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Developer Handoff</h3>
          <p className="mt-1 max-w-xl text-sm text-gray-400">
            Send all recommended fixes to your developer in one message.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={developerEmail.mailtoHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Send all to developer
          </a>
          <button
            type="button"
            onClick={() => void copyEmail()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-500/60 hover:bg-blue-500/15"
          >
            {copied === 'email' ? 'Email copied' : 'Copy developer email'}
          </button>
          <button
            type="button"
            onClick={() => void copyTicket()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-xs font-semibold text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
          >
            {copied === 'ticket' ? 'Ticket copied' : 'Generate combined ticket'}
          </button>
          <button
            type="button"
            disabled
            title="PDF export coming soon — use Copy developer email for now"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-2 text-xs font-medium text-gray-500"
          >
            Export developer handoff
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTicketOpen((open) => !open)}
          className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-300"
        >
          {ticketOpen ? 'Hide combined ticket preview' : 'Preview combined ticket'}
        </button>
      </div>

      {ticketOpen && (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/80 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Combined ticket preview
          </p>
          <p className="mb-3 text-sm font-medium text-white">{ticket.title}</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-300">
            {ticket.body}
          </pre>
        </div>
      )}
    </div>
  );
}
