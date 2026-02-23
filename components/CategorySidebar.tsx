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

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-24">
        <nav className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            📋 {hub.categorySlug} 비교 가이드
          </h3>
          <ul className="space-y-1">
            {hub.spokes.map((spoke) => {
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

          {/* 허브 가이드 링크 */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Link
              href={`/${categorySlug}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              {hub.categorySlug} 가이드 전체 보기
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
