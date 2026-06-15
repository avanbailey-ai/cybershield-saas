'use client';

import { useState } from 'react';
import { shareResultUrl } from '@/lib/share/token';
import { trackViralEvent } from '@/lib/analytics/viral';

interface ShareResultModalProps {
  domain: string;
  score: number;
  shareToken?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareResultModal({
  domain,
  score,
  shareToken,
  isOpen,
  onClose,
}: ShareResultModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = shareToken
    ? shareResultUrl(shareToken, origin)
    : `${origin}/scan-result?domain=${encodeURIComponent(domain)}&score=${score}`;

  const embedText = `I just scanned my website security with CyberShield — Risk Score: ${score}/100\n${shareUrl}`;

  const tweetText = encodeURIComponent(
    `I just scanned ${domain} with CyberShield — security score: ${score}/100. Check yours free:`,
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      void trackViralEvent('link_copied', { domain, score, shareToken: shareToken ?? undefined, channel: 'link' });
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  async function handleCopyEmbed() {
    try {
      await navigator.clipboard.writeText(embedText);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
      void trackViralEvent('link_copied', { domain, score, shareToken: shareToken ?? undefined, channel: 'embed' });
    } catch {
      setCopiedEmbed(false);
    }
  }

  function handleSocialShare(channel: 'twitter' | 'linkedin') {
    void trackViralEvent('scan_shared', { domain, score, shareToken: shareToken ?? undefined, channel });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Share Your Results</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          Share your security score and challenge others to scan their site.
        </p>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-sm text-gray-300 outline-none"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {copiedLink ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyEmbed}
          className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          {copiedEmbed ? 'Embed copied!' : 'Copy embed snippet'}
        </button>

        <div className="flex flex-col gap-2">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleSocialShare('twitter')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-gray-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </a>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleSocialShare('linkedin')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-gray-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.128 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share on LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
