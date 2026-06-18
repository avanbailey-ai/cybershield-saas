import type { ReactNode } from 'react';

const MEMORY_TRACKS = [
  {
    title: 'Security posture',
    description:
      'Track score changes over time. See when headers disappear or new vulnerabilities appear — and when fixes take effect.',
    icon: 'shield',
  },
  {
    title: 'SSL & domain lifecycle',
    description:
      'Certificate renewals, expiry warnings, and domain registration events — recorded so nothing slips through during busy periods.',
    icon: 'lock',
  },
  {
    title: 'Uptime & availability',
    description:
      'Downtime events and recovery timestamps. Understand when your site was unreachable and how long leads were affected.',
    icon: 'uptime',
  },
  {
    title: 'Website changes',
    description:
      'Scripts added or removed, header changes, page structure shifts — grouped into clear events on your Change Timeline.',
    icon: 'timeline',
  },
] as const;

const iconMap: Record<string, ReactNode> = {
  shield: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  lock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  uptime: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  timeline: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function WebsiteMemory() {
  return (
    <section className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-blue-800/30 bg-gradient-to-br from-blue-950/30 to-gray-900/50 p-8 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
              Continuous Memory
            </p>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              CyberShield is the memory of your website
            </h2>
            <p className="text-base leading-relaxed text-gray-400">
              One-time scans tell you what happened today. CyberShield remembers everything — SSL
              renewals, header changes, downtime events, score trends, and resolved findings. When
              something changes, you have context, not just an alert.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {MEMORY_TRACKS.map((track) => (
              <div
                key={track.title}
                className="rounded-xl border border-gray-800/80 bg-gray-900/40 p-5"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 ring-1 ring-blue-600/20">
                  {iconMap[track.icon]}
                </div>
                <h3 className="text-base font-semibold text-white">{track.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{track.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
