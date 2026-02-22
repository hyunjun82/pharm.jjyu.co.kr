import Link from "next/link";
import { User, ArrowRight } from "lucide-react";

export function AuthorBio() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
        <div className="flex items-start gap-4">
          {/* 아바타 */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <User className="h-6 w-6" />
          </div>

          {/* 정보 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                약정보 에디터
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                의약품 정보 전문
              </span>
            </div>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              공공데이터 기반으로 일반의약품 성분, 효능, 부작용 정보를 쉽게 풀어드려요.
              정확한 정보 전달을 위해 식약처 공식 데이터를 활용합니다.
            </p>
            <Link
              href="/about"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              작성자 소개
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
