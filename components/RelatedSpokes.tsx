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

  const otherSpokes = hub.spokes.filter((s) => s.slug !== currentSlug);
  if (otherSpokes.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">
          📋 다른 {hub.categorySlug}도 비교해 보세요
        </h3>
        <div className="space-y-2.5">
          {otherSpokes.map((spoke) => (
            <Link
              key={spoke.slug}
              href={`/${categorySlug}/${spoke.slug}`}
              className="group flex items-start gap-2.5 rounded-lg bg-white px-4 py-3 border border-gray-100 transition-all hover:border-emerald-200 hover:shadow-sm"
            >
              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  {spoke.slug} 성분 효과 부작용까지
                </span>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {spoke.description}
                </p>
              </div>
            </Link>
          ))}

          {/* 허브 가이드 링크 */}
          <Link
            href={`/${categorySlug}`}
            className="group flex items-center gap-2.5 rounded-lg bg-white px-4 py-3 border border-gray-100 transition-all hover:border-emerald-200 hover:shadow-sm"
          >
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            <span className="text-sm font-medium text-gray-600 group-hover:text-emerald-600 transition-colors">
              {hub.categorySlug} 가이드 전체 보기
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
