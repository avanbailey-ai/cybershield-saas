const steps = [
  {
    number: "01",
    title: "Add Your Website",
    description:
      "Enter your website URL for a free one-time scan. On a paid plan, CyberShield then sets up continuous monitoring for SSL, domain, uptime, and security checks — no agents required.",
  },
  {
    number: "02",
    title: "CyberShield Monitors Continuously",
    description:
      "On paid plans, scheduled checks track certificates, headers, page structure, and availability. Changes are compared against your baseline automatically.",
  },
  {
    number: "03",
    title: "Review the Health Center",
    description:
      "See security score, SSL/domain status, uptime, recent changes, and active findings in one executive view per website.",
  },
  {
    number: "04",
    title: "Get Alerts When It Matters",
    description:
      "Email alerts when certificates near expiry, sites go down, headers disappear, or scores drop — with clear context and next steps.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
            How It Works
          </p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            From free scan to continuous protection
          </h2>
          <p className="mx-auto max-w-xl text-base text-gray-400 sm:text-gray-400">
            Start with a free scan, then enable monitoring to track changes over time — not just
            today&apos;s snapshot.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative flex flex-col">
              {idx < steps.length - 1 && (
                <div className="absolute left-full top-5 hidden h-px w-full bg-gray-800 lg:block" style={{ width: "calc(100% - 2.5rem)", left: "2.5rem" }} />
              )}
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-blue-800/60 bg-blue-950/40 text-sm font-bold text-blue-400">
                {step.number}
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{step.title}</h3>
              <p className="text-base leading-relaxed text-gray-400 sm:text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
