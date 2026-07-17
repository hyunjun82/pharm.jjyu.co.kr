import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { hubArticles } from "@/data/articles";

interface RelatedSpokesProps {
  categorySlug: string;
  currentSlug: string;
}

export function RelatedSpokes({ categorySlug, currentSlug }: RelatedSpokesProps) {
  const hub = hubArticles[categorySlug];
  if (!hub) return null;

  const allOtherSpokes = hub.spokes.filter((s) => s.slug !== currentSlug);
  if (allOtherSpokes.length === 0) return null;

  const displaySpokes = allOtherSpokes.slice(0, 3);
  const hasMore = allOtherSpokes.length > 3;

  const anchorPatterns: ((slug: string) => string)[] = [
    (s) => `${s} 효과 언제부터?`,
    (s) => `${s} 부작용 신호와 대응`,
    (s) => `${s} 정확한 사용법`,
    (s) => `${s} 최저가 가격 비교`,
    (s) => `${s} 성분 분석`,
    (s) => `${s} 주의사항·금기`,
    (s) => `${s} 같은 성분 다른 제품`,
    (s) => `${s} 종합 가이드`,
  ];

  return (
    <section className="mb-8">
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">
          📋 다른 {hub.categorySlug}도 비교해 보세요
        </h3>
        <div className="space-y-2.5">
          {displaySpokes.map((spoke, idx) => {
            const anchor = anchorPatterns[idx % anchorPatterns.length](spoke.slug);
            return (
              <Link
                key={spoke.slug}
                href={`/${categorySlug}/${spoke.slug}`}
                className="group flex items-start gap-2.5 rounded-lg bg-white px-4 py-3 border border-gray-100 transition-all hover:border-emerald-200 hover:shadow-sm"
              >
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                    {anchor}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {spoke.description}
                  </p>
                </div>
              </Link>
            );
          })}

          {/* 허브 가이드 링크 */}
          <Link
            href={`/${categorySlug}`}
            className="group flex items-center gap-2.5 rounded-lg bg-white px-4 py-3 border border-gray-100 transition-all hover:border-emerald-200 hover:shadow-sm"
          >
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            <span className="text-sm font-medium text-gray-600 group-hover:text-emerald-600 transition-colors">
              {hasMore
                ? `${hub.categorySlug} ${allOtherSpokes.length}개 더 비교하기`
                : `${hub.categorySlug} 가이드 전체 보기`}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
