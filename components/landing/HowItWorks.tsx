const steps = [
  {
    number: "01",
    title: "Add Your Website",
    description: "Enter your website URL and CyberShield begins configuring your monitoring profile.",
  },
  {
    number: "02",
    title: "CyberShield Analyzes Security Signals",
    description: "We scan SSL certificates, HTTP headers, open ports, DNS records, and known vulnerabilities.",
  },
  {
    number: "03",
    title: "Receive Alerts & Insights",
    description: "Get instant notifications when threats are detected, with clear remediation guidance.",
  },
  {
    number: "04",
    title: "Improve Security Posture",
    description: "Track your security score over time, close gaps, and demonstrate improvement to stakeholders.",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 px-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-500">
            How It Works
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mx-auto max-w-xl text-gray-400">
            No agents, no complex setup. Just add your website and let CyberShield do the work.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative flex flex-col">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="absolute left-full top-5 hidden h-px w-full bg-gray-800 lg:block" style={{ width: "calc(100% - 2.5rem)", left: "2.5rem" }} />
              )}
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-blue-800/60 bg-blue-950/40 text-sm font-bold text-blue-400">
                {step.number}
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
