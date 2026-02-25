"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdSlot() {
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

  return (
    <div className="my-4 overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-2442517902625121"
        data-ad-slot="3463438836"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
