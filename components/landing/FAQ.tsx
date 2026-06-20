"use client";

import { useState } from "react";
import { LANDING_FAQS } from "@/lib/seo/faqs";

const faqs = [...LANDING_FAQS];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative px-4 py-10 sm:px-4 sm:py-24 md:px-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center sm:mb-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500 sm:mb-3 sm:text-sm">FAQ</p>
          <h2 className="mb-3 text-xl font-bold tracking-tight text-white sm:mb-4 sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 sm:rounded-xl"
            >
              <button
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:min-h-[56px] sm:gap-4 sm:px-6 sm:py-5"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <span className="text-sm font-semibold text-white sm:text-base">{faq.question}</span>
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
                <div className="border-t border-gray-800 px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
                  <p className="text-sm leading-relaxed text-gray-400">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
