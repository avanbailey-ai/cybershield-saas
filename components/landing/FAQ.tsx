"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does monitoring work?",
    answer:
      "Pro includes daily automated monitoring checks plus weekly deep scans. Growth adds hourly monitoring checks and change detection. Agency includes 5-minute monitoring for priority websites and hourly monitoring for remaining sites. Manual deep scans have separate daily quotas and do not count scheduled monitoring checks.",
  },
  {
    question: "How often are websites checked?",
    answer:
      "Pro runs daily monitoring checks with weekly deep scans. Growth runs hourly monitoring checks with weekly deep scans. Agency runs 5-minute monitoring for priority websites and hourly checks for the rest. You can also run manual deep scans from the dashboard within your plan quota.",
  },
  {
    question: "Does CyberShield perform penetration testing?",
    answer:
      "No. CyberShield is a passive monitoring and reconnaissance platform. We analyze publicly observable signals and known vulnerability patterns. We do not perform active exploitation or intrusive penetration testing against your systems.",
  },
  {
    question: "Can I monitor multiple websites?",
    answer:
      "Yes. Pro includes 10 websites, Growth includes 50, and Agency includes 250 websites. Enterprise plans use custom limits after a security review.",
  },
  {
    question: "Is there a free option?",
    answer:
      "Yes. Use the free public scan at /scan — no account required. To monitor websites continuously with alerts and a full dashboard, choose a paid plan after signing up.",
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
