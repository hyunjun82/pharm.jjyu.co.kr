"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        자주 묻는 질문
      </h2>
      <div className="divide-y divide-gray-200 rounded-xl border border-gray-200">
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900 pr-4">
                {item.question}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                openIndex === i ? "max-h-96" : "max-h-0"
              }`}
            >
              <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
