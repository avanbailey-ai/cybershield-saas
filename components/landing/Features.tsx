import type { ReactNode } from "react";

const features = [
  {
    icon: "health",
    title: "Health Center",
    description:
      "One dashboard per website — security score, SSL, domain, uptime, and alerts. See business-critical status at a glance without digging through logs.",
  },
  {
    icon: "shield",
    title: "Security Scoring",
    description:
      "A 0–100 score tracks your posture over time. When headers disappear or vulnerabilities appear, the score drops — and you get context on why.",
  },
  {
    icon: "lock",
    title: "SSL & Domain Monitoring",
    description:
      "Expired SSL triggers browser warnings that erode trust and reduce conversions. Domain lapses can take your site offline entirely — we alert you early.",
  },
  {
    icon: "timeline",
    title: "Change Timeline",
    description:
      "Everything that happened to your website — score changes, new scripts, header removals, SSL events. CyberShield remembers so you don't have to.",
  },
  {
    icon: "chart",
    title: "Continuous Monitoring",
    description:
      "Pro checks daily, Growth hourly, Agency priority sites every 5 minutes. Catch downtime, certificate issues, and malicious changes between manual reviews.",
  },
  {
    icon: "bell",
    title: "Email Alerts & Digests",
    description:
      "Get notified when something important changes — plus weekly and monthly summaries. Act on SSL expiry or downtime before leads stop and revenue drops.",
  },
];

const iconMap: Record<string, ReactNode> = {
  health: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
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
  timeline: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  bell: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
};

export default function Features() {
  return (
    <section className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
            Platform Features
          </p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Monitor what matters to your business
          </h2>
          <p className="mx-auto max-w-2xl text-base text-gray-400 sm:text-gray-400">
            SSL expiry, downtime, security gaps, and unauthorized changes — each can cost trust,
            leads, and revenue. CyberShield watches continuously so you can respond early.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-all duration-200 hover:border-gray-700 hover:bg-gray-900 sm:p-6"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400 ring-1 ring-blue-600/20 group-hover:bg-blue-600/15">
                {iconMap[feature.icon]}
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
              <p className="text-base leading-relaxed text-gray-400 sm:text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
