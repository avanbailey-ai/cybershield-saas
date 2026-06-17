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
    <section id="how-it-works" className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">
            How It Works
          </p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mx-auto max-w-xl text-base text-gray-400 sm:text-gray-400">
            Add your website — no agents or complex setup.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
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
              <p className="text-base leading-relaxed text-gray-400 sm:text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
