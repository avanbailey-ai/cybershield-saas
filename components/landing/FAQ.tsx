"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does monitoring work?",
    answer:
      "CyberShield runs automated checks against your websites on a scheduled basis — scanning SSL certificates, HTTP security headers, open ports, DNS records, and known vulnerability signatures. Results are aggregated into a security score and stored for trend analysis.",
  },
  {
    question: "Does CyberShield perform penetration testing?",
    answer:
      "No. CyberShield is a passive monitoring and reconnaissance platform. We analyze publicly observable signals and known vulnerability patterns. We do not perform active exploitation or intrusive penetration testing against your systems.",
  },
  {
    question: "How often are websites checked?",
    answer:
      "On the Starter plan, websites are scanned weekly. The Professional plan includes daily scans, and Business customers receive near-real-time monitoring with priority scan queues. You can also trigger manual scans at any time.",
  },
  {
    question: "Can I monitor multiple websites?",
    answer:
      "Yes. All plans support monitoring multiple websites from a single dashboard. The Starter plan includes up to 3 websites, Professional up to 25, and the Business plan includes unlimited websites with team-based access controls.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. You can create a free account and begin monitoring your first website immediately with no credit card required. The free tier gives you access to basic monitoring features so you can evaluate CyberShield before committing to a paid plan.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative py-24 px-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-500">FAQ</p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden"
            >
              <button
                className="flex w-full items-center justify-between px-6 py-5 text-left"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <span className="text-sm font-semibold text-white">{faq.question}</span>
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-200 ${
                    openIndex === idx ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === idx && (
                <div className="border-t border-gray-800 px-6 pb-5 pt-4">
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
