import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface PriceCTAProps {
  name: string;
  barkiryQuery?: string;
  barkiryProductId?: string;
  externalSearchUrl?: string;
  categorySlug?: string;
}

export function PriceCTA({ name, barkiryQuery, barkiryProductId, externalSearchUrl, categorySlug }: PriceCTAProps) {
  const hasLink = !!(barkiryProductId || externalSearchUrl || barkiryQuery);
  if (!hasLink) {
    if (!categorySlug) return null;
    return (
      <Link
        href={`/${categorySlug}/가격비교`}
        className="group block w-full rounded-xl bg-gray-100 px-6 py-5 text-center text-gray-800 shadow transition-all duration-200 hover:bg-gray-200 hover:-translate-y-0.5"
      >
        <span className="flex items-center justify-center gap-2 text-lg font-bold">
          📋 {name} 약국 가격 정보 보기
        </span>
        <span className="block text-sm text-gray-500 mt-1">
          카테고리 전체 약국 기준가 비교 →
        </span>
      </Link>
    );
  }

  const barkiryUrl = barkiryProductId
    ? `https://barkiri.com/products/${barkiryProductId}`
    : externalSearchUrl
      ? externalSearchUrl
      : `https://barkiri.com/search?query=${encodeURIComponent(barkiryQuery!)}`;

  return (
    <a
      href={barkiryUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group block w-full rounded-xl bg-emerald-600 px-6 py-5 text-center text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-xl"
    >
      <span className="flex items-center justify-center gap-2 text-lg font-bold">
        💊 {name} 최저가 확인하기
        <ExternalLink className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className="block text-sm text-emerald-100 mt-1">
        약국별 실시간 가격 비교 →
      </span>
    </a>
  );
}
