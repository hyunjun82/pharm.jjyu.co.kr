"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

type AdSlotType = "top" | "hero" | "bottom";

const AD_CONFIG: Record<AdSlotType, Record<string, string>> = {
  top: {
    "data-ad-slot": "3585199085",
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
  hero: {
    "data-ad-slot": "6501483950",
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
  bottom: {
    "data-ad-slot": "7413238819",
    "data-ad-format": "autorelaxed",
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

  return (
    <div className="my-4 overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-2442517902625121"
        {...config}
      />
    </div>
  );
}
