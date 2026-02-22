import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Database,
  ShieldCheck,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { categories } from "@/data/categories";

export const metadata: Metadata = {
  title: "의약품 에디터 소개",
  description:
    "의약품 에디터의 프로필, 콘텐츠 작성 방법론, 데이터 출처를 소개합니다. 식약처 공공데이터 기반으로 정확한 의약품 정보를 전달합니다.",
};

function CapsuleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="8" y="2" width="8" height="20" rx="4" fill="currentColor" opacity="0.2" />
      <rect x="8" y="2" width="8" height="10" rx="4" fill="currentColor" />
      <rect x="8" y="2" width="8" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            <Link href="/" className="hover:text-emerald-600">
              홈
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">작성자 소개</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CapsuleIcon className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                의약품 에디터
              </h1>
              <p className="mt-1 text-base text-gray-500">
                의약품 정보 전문 에디터
              </p>
              <Badge className="mt-2 bg-emerald-600 text-white hover:bg-emerald-600">
                공공데이터 기반 콘텐츠
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="mx-auto max-w-3xl px-4 py-10 space-y-10">
        {/* 소개 */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-emerald-500">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">소개</h2>
          </div>
          <div className="text-[15px] text-gray-600 leading-[1.85] pl-[42px] space-y-3">
            <p>
              의약품 에디터는 일반의약품(OTC)에 대한 정확하고 이해하기 쉬운 정보를
              제공하기 위해 식약처(식품의약품안전처) 공식 공공데이터를 활용하여
              콘텐츠를 작성합니다.
            </p>
            <p>
              탈모약, 연고, 감기약, 진통제, 무좀약, 설사약, 소화제, 안약 등
              일반의약품의 성분 분석, 효능, 올바른 사용법, 부작용, 주의사항을
              다루고 있으며, 전문 의학 용어를 일반인이 이해할 수 있는 쉬운 말로
              풀어서 전달합니다.
            </p>
          </div>
        </section>

        <Separator />

        {/* 방법론 */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-blue-500">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              콘텐츠 작성 방법론
            </h2>
          </div>
          <div className="text-[15px] text-gray-600 leading-[1.85] pl-[42px] space-y-3">
            <p>모든 의약품 정보는 다음 프로세스를 거쳐 작성됩니다.</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>공공데이터 수집</strong> — 식약처 의약품안전나라 API에서
                성분, 효능, 용법 데이터를 수집합니다.
              </li>
              <li>
                <strong>교차 검증</strong> — 약학정보원(KPIC), 대한약사회 자료
                등과 교차 확인합니다.
              </li>
              <li>
                <strong>전문 용어 풀이</strong> — 의학 용어를 일반인이 이해할 수
                있는 쉬운 표현으로 변환합니다.
              </li>
              <li>
                <strong>구조화 작성</strong> — 성분, 효능, 사용법, 부작용,
                주의사항, 보관법 순서로 작성합니다.
              </li>
              <li>
                <strong>정기 검토</strong> — 식약처 데이터 변경 시 콘텐츠를
                업데이트합니다.
              </li>
            </ol>
          </div>
        </section>

        <Separator />

        {/* 데이터 출처 */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-violet-500">
              <Database className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">데이터 출처</h2>
          </div>
          <div className="text-[15px] text-gray-600 leading-[1.85] pl-[42px] space-y-3">
            <ul className="space-y-2">
              <li>식품의약품안전처 의약품안전나라 (nedrug.mfds.go.kr)</li>
              <li>공공데이터포털 의약품 개요정보 API (data.go.kr)</li>
              <li>약학정보원 KPIC (health.kr)</li>
              <li>대한약사회 의약품 정보</li>
            </ul>
          </div>
        </section>

        <Separator />

        {/* 편집 정책 */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-orange-500">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">편집 정책</h2>
          </div>
          <div className="text-[15px] text-gray-600 leading-[1.85] pl-[42px] space-y-3">
            <p>
              약정보의 모든 콘텐츠는 정보 제공 목적으로 작성되며, 전문적인 의학적
              진단이나 치료를 대체하지 않습니다. 의약품 복용 전 반드시 전문의 또는
              약사와 상담하시기 바랍니다.
            </p>
            <p>
              가격 정보는 실시간 변동될 수 있으며, 정확한 가격은 약국에서 직접
              확인하시기 바랍니다.
            </p>
          </div>
        </section>

        {/* 카테고리 */}
        <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            다루는 카테고리
          </h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}`}>
                <Badge
                  variant="outline"
                  className="hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  {cat.icon} {cat.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </article>

      {/* Back */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>
      </div>

      {/* ProfilePage 스키마 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: "의약품 에디터",
              url: "https://pharm.jjyu.co.kr/about",
              jobTitle: "의약품 정보 전문 에디터",
              description:
                "식약처 공공데이터 기반으로 일반의약품 성분, 효능, 부작용 정보를 전문적으로 분석하고 전달하는 에디터입니다.",
              worksFor: {
                "@type": "Organization",
                name: "약정보",
                url: "https://pharm.jjyu.co.kr",
              },
              knowsAbout: [
                "일반의약품(OTC) 성분 분석",
                "의약품 효능 및 부작용 분석",
                "복약 지도",
                "의약품 가격 비교 데이터",
              ],
            },
          }),
        }}
      />

      {/* BreadcrumbList 스키마 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "홈",
                item: "https://pharm.jjyu.co.kr",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "작성자 소개",
                item: "https://pharm.jjyu.co.kr/about",
              },
            ],
          }),
        }}
      />
    </>
  );
}
