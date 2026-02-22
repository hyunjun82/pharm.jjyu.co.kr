import Link from "next/link";
import { ArrowRight, Calendar, Database } from "lucide-react";

interface AuthorBioProps {
  categoryName?: string;
  datePublished?: string;
  dateModified?: string;
}

function formatKoreanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

function CapsuleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="8"
        y="2"
        width="8"
        height="20"
        rx="4"
        fill="currentColor"
        opacity="0.2"
      />
      <rect
        x="8"
        y="2"
        width="8"
        height="10"
        rx="4"
        fill="currentColor"
      />
      <rect
        x="8"
        y="2"
        width="8"
        height="20"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function AuthorBio({ categoryName, datePublished, dateModified }: AuthorBioProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <div className="flex items-start gap-4">
          {/* 아바타 - 캡슐 아이콘 */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CapsuleIcon className="h-6 w-6" />
          </div>

          {/* 정보 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">
                의약품 에디터
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                의약품 정보 전문
              </span>
              {categoryName && (
                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {categoryName}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              공공데이터 기반으로 일반의약품 성분, 효능, 부작용 정보를 쉽게 풀어드려요.
              정확한 정보 전달을 위해 식약처 공식 데이터를 활용합니다.
            </p>

            {/* 날짜 */}
            {(datePublished || dateModified) && (
              <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-gray-400">
                {datePublished && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    작성 {formatKoreanDate(datePublished)}
                  </span>
                )}
                {dateModified && dateModified !== datePublished && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    수정 {formatKoreanDate(dateModified)}
                  </span>
                )}
              </div>
            )}

            {/* 출처 + 소개 링크 */}
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                <Database className="h-2.5 w-2.5" />
                식약처 공공데이터
              </span>
              <Link
                href="/about"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                작성자 소개
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
