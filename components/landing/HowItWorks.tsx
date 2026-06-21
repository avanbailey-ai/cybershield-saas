const steps = [
  {
    number: "01",
    title: "Enter your website",
    description:
      "Run a free scan or add your site after signup. CyberShield checks common security signals from the public web — no agents required.",
  },
  {
    number: "02",
    title: "CyberShield checks common security signals",
    description:
      "We analyze SSL/TLS, headers, domain signals, uptime, and page structure to build a baseline and risk summary.",
  },
  {
    number: "03",
    title: "Get a plain-English risk summary",
    description:
      "See a security score, prioritized findings, and clear explanations of what each issue means for your business.",
  },
  {
    number: "04",
    title: "Subscribe for monitoring, alerts, and full reports",
    description:
      "Paid plans unlock continuous monitoring, email alerts, scan history, change detection, and complete reports — not available on the free preview alone.",
  },
  {
    number: "05",
    title: "Use remediation guidance or share with your developer",
    description:
      "Follow step-by-step fix guidance in the dashboard or export findings for your team. CyberShield improves visibility; you validate and apply fixes.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-4 py-10 sm:px-4 sm:py-24 md:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center sm:mb-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500 sm:mb-3 sm:text-sm">
            How CyberShield Works
          </p>
          <h2 className="mb-3 text-xl font-bold tracking-tight text-white sm:mb-4 sm:text-4xl">
            From free scan to continuous protection
          </h2>
          <p className="mx-auto max-w-xl text-sm text-gray-400 sm:text-base">
            Start with a free scan, then subscribe to monitor changes over time — not just today&apos;s
            snapshot.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-5">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative flex flex-col">
              {idx < steps.length - 1 && (
                <div className="absolute left-full top-5 hidden h-px w-full bg-gray-800 lg:block" style={{ width: "calc(100% - 2.5rem)", left: "2.5rem" }} />
              )}
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-blue-800/60 bg-blue-950/40 text-xs font-bold text-blue-400 sm:mb-4 sm:h-10 sm:w-10 sm:text-sm">
                {step.number}
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-white sm:mb-2 sm:text-base">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
