"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

// pharm1: 서론/제품카드 아래, pharm2: 본문 중간(H2 사이), pharm3: FAQ 아래, pharm4: 모바일 하단 고정
type AdSlotType = "top" | "hero" | "bottom" | "anchor";

const AD_CONFIG: Record<AdSlotType, Record<string, string>> = {
  top: {
    "data-ad-slot": "4254302985",   // pharm1
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
  hero: {
    "data-ad-slot": "5663020324",   // pharm2
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
  bottom: {
    "data-ad-slot": "5506974207",   // pharm3
    "data-ad-format": "autorelaxed",
  },
  anchor: {
    "data-ad-slot": "2880810862",   // pharm4
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
};

export function AdSlot({ slot = "top" }: { slot?: AdSlotType }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle 아직 로드 안 됨 — lazyOnload 이후 자동 처리됨
    }
  }, []);

  const config = AD_CONFIG[slot];

  if (slot === "anchor") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-100">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-2442517902625121"
          {...config}
        />
      </div>
    );
  }

  return (
    <div className="my-4 overflow-hidden" style={{ minHeight: slot === "bottom" ? 200 : 100 }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-2442517902625121"
        {...config}
      />
    </div>
  );
}
