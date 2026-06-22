'use client';

import { useCallback, useMemo, useState } from 'react';
import type { SecurityFinding } from '@/lib/securityIntelligence/types';
import {
  buildDeveloperEmailPayload,
  buildTicketPayload,
  type FindingActionContext,
} from '@/lib/findings';

interface FindingActionBarProps {
  finding: SecurityFinding;
  context: FindingActionContext;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export default function FindingActionBar({
  finding,
  context,
  className = '',
  variant = 'primary',
}: FindingActionBarProps) {
  const [copied, setCopied] = useState<'ticket' | 'email' | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const secondary = variant === 'secondary';

  const developerEmail = useMemo(
    () => buildDeveloperEmailPayload(finding, context),
    [finding, context],
  );

  const ticket = useMemo(
    () => buildTicketPayload(finding, context),
    [finding, context],
  );

  const copyTicket = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ticket.body);
      setCopied('ticket');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setTicketOpen(true);
    }
  }, [ticket.body]);

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(developerEmail.body);
      setCopied('email');
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked */
    }
  }, [developerEmail.body]);

  const primaryBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-500/50 hover:bg-blue-500/15';
  const secondaryBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/40 px-2.5 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200';
  const mutedBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/40 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-gray-700 hover:text-gray-300';

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {secondary && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Individual finding actions
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href={developerEmail.mailtoHref}
          className={secondary ? secondaryBtn : primaryBtn}
        >
          {secondary ? 'Send this finding' : 'Send to developer'}
        </a>
        <button
          type="button"
          onClick={() => void copyEmail()}
          className={secondary ? mutedBtn : secondaryBtn.replace('text-gray-400', 'text-gray-200')}
        >
          {copied === 'email' ? 'Email copied' : secondary ? 'Copy email' : 'Copy full developer email'}
        </button>
        <button
          type="button"
          onClick={() => void copyTicket()}
          className={secondary ? mutedBtn : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800'}
        >
          {copied === 'ticket' ? 'Ticket copied' : 'Generate ticket'}
        </button>
        <button
          type="button"
          onClick={() => setTicketOpen((open) => !open)}
          className={secondary ? mutedBtn : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200'}
        >
          {ticketOpen ? 'Hide ticket preview' : 'Preview ticket'}
        </button>
      </div>

      {ticketOpen && (
        <div className="rounded-lg border border-gray-800 bg-gray-950/80 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Ticket preview
          </p>
          <p className="mb-3 text-sm font-medium text-white">{ticket.title}</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-300">
            {ticket.body}
          </pre>
        </div>
      )}
    </div>
  );
}
