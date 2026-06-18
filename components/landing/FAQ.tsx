"use client";

import { useState } from "react";
import { LANDING_FAQS } from "@/lib/seo/faqs";

const faqs = [...LANDING_FAQS];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative px-5 py-16 sm:px-4 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gray-800/60" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-500">FAQ</p>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50"
            >
              <button
                className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <span className="text-base font-semibold text-white sm:text-sm">{faq.question}</span>
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
                <div className="border-t border-gray-800 px-5 pb-5 pt-4 sm:px-6">
                  <p className="text-base leading-relaxed text-gray-400 sm:text-sm">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
