import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { hubArticles } from "@/data/articles";

interface CategorySidebarProps {
  categorySlug: string;
  currentSlug: string;
}

export function CategorySidebar({ categorySlug, currentSlug }: CategorySidebarProps) {
  const hub = hubArticles[categorySlug];
  if (!hub) return null;

  // 색인 보호(2026-06-17): 같은 카테고리 전체(수백 개)를 매 페이지에 링크 덤프하면
  // 구글이 도어웨이/링크팜으로 보고 색인을 보류함(GSC "크롤됨-색인안됨" 2,031건의 핵심 원인).
  // 현재 글 기준으로 결정적 회전한 15개만 노출 → 페이지마다 다른 15개라 크롤 예산 분산 + 도어웨이 신호 제거.
  // 전체 목록은 아래 "가이드 전체 보기"(허브)로 이동.
  const MAX_SIDEBAR_LINKS = 15;
  const others = hub.spokes.filter((s) => s.slug !== currentSlug);
  const current = hub.spokes.find((s) => s.slug === currentSlug);
  let picks = others;
  if (others.length > MAX_SIDEBAR_LINKS) {
    const seed = Array.from(currentSlug).reduce((a, c) => a + c.charCodeAt(0), 0);
    const start = seed % others.length;
    picks = Array.from({ length: MAX_SIDEBAR_LINKS }, (_, i) => others[(start + i) % others.length]);
  }
  const displaySpokes = current ? [current, ...picks] : picks;

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24">
        <nav className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            📋 {hub.categorySlug} 비교 가이드
          </h3>
          <ul className="space-y-1">
            {displaySpokes.map((spoke) => {
              const isCurrent = spoke.slug === currentSlug;
              return (
                <li key={spoke.slug}>
                  <Link
                    href={`/${categorySlug}/${spoke.slug}`}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isCurrent
                        ? "bg-emerald-50 text-emerald-700 font-bold border-l-2 border-emerald-500"
                        : "text-gray-600 hover:bg-gray-50 hover:text-emerald-600"
                    }`}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isCurrent ? "text-emerald-500" : "text-gray-300 group-hover:text-emerald-400"
                      }`}
                    />
                    <span className="truncate">{spoke.slug}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* 허브 가이드 링크 + 가격비교 */}
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            <Link
              href={`/${categorySlug}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              {hub.categorySlug} 가이드 전체 보기
            </Link>
            <Link
              href={`/${categorySlug}/가격비교`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              💰 가격비교 보기
            </Link>
          </div>
        </nav>

        {/* 향후 AdSense 슬롯 */}
        {/* <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <ins className="adsbygoogle" ... />
        </div> */}
      </div>
    </aside>
  );
}
