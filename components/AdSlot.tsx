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
    "data-ad-format": "rectangle",  // auto+full-width-responsive가 뷰포트 전체 높이로 렌더링되는 버그 발견(2026-07-08) — 사각형 고정 포맷으로 제한
  },
  hero: {
    "data-ad-slot": "5663020324",   // pharm2
    "data-ad-format": "rectangle",
  },
  bottom: {
    "data-ad-slot": "5506974207",   // pharm3
    "data-ad-format": "auto",
    "data-full-width-responsive": "true",
  },
  anchor: {
    "data-ad-slot": "2880810862",   // pharm4
    // 2026-08-12: auto+full-width-responsive가 모바일에서 화면 절반을 덮는 문제(2026-07-08 top/hero와 동일 버그).
    //   가로 배너 형식으로 바꾸고 컨테이너에 높이 상한(모바일 60px, PC 90px)을 걸어
    //   어떤 광고가 와도 배너 높이를 못 넘게 물리적으로 제한.
    "data-ad-format": "horizontal",
    "data-full-width-responsive": "false",
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
      <div className="fixed bottom-0 left-0 right-0 z-40 h-[60px] overflow-hidden bg-white border-t border-gray-100 sm:h-[90px]">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", height: "100%" }}
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
