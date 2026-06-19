import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

interface PageProps {
  searchParams: Promise<{ domain?: string; score?: string; token?: string }>;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400 border-green-500/40';
  if (score >= 40) return 'text-yellow-400 border-yellow-500/40';
  return 'text-red-400 border-red-500/40';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Moderate Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const domain = params.domain ?? 'a website';
  const score = params.score ? parseInt(params.score, 10) : null;

  const title = score !== null
    ? `${domain} scored ${score}/100 on CyberShield`
    : `Security scan results for ${domain}`;

  return {
    title,
    description: `Free security scan results for ${domain}. Check your website's security score with CyberShield.`,
    openGraph: {
      title,
      description: `Security score: ${score ?? '?'}/100. Scan your site for free.`,
    },
  };
}

/** Legacy query-param share page — new shares use /scan-result/[share_token]. */
export default async function ScanResultLegacyPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (params.token) {
    redirect(`/scan-result/${params.token}`);
  }

  const domain = params.domain ?? '';
  const score = params.score ? Math.min(100, Math.max(0, parseInt(params.score, 10))) : null;

  if (!domain) {
    redirect('/scan');
  }

  const shareBase = resolveSiteUrl();
  const shareUrl = `/scan-result?domain=${encodeURIComponent(domain)}&score=${score ?? ''}`;
  const tweetText = encodeURIComponent(
    `I scanned ${domain} with CyberShield${score !== null ? ` — score: ${score}/100` : ''}. Check yours:`,
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-gray-800/60 bg-[#0a0f1e]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">CyberShield</span>
          </Link>
          <Link href="/scan" className="text-sm text-blue-400 hover:text-blue-300">
            Scan another site →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Security Scan Results</h1>
        <p className="mt-2 text-gray-400">{domain}</p>
        <p className="mx-auto mt-3 max-w-lg text-sm text-gray-500">
          A single scan shows your posture today. Compare monitoring plans when you want SSL,
          uptime, and change alerts after the scan.
        </p>

        {score !== null && !Number.isNaN(score) && (
          <div className="mt-8 flex flex-col items-center">
            <div
              className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 ${scoreColor(score)}`}
            >
              <span className="text-4xl font-bold">{score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-300">{scoreLabel(score)}</p>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/scan"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Run your own free security scan
          </Link>
          <a
            href={`https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(
              `${shareBase}${shareUrl}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Share on X
          </a>
        </div>
      </main>
    </div>
  );
}
