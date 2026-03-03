import Link from "next/link";

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
        className="group block w-full rounded-xl bg-emerald-600 px-6 py-5 text-center text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-xl"
      >
        <span className="flex items-center justify-center gap-2 text-lg font-bold">
          💊 {name} 최저가 확인하기
        </span>
        <span className="block text-sm text-emerald-100 mt-1">
          약국별 실시간 가격 비교 →
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
      rel="noopener noreferrer nofollow"
      className="group block w-full rounded-xl bg-emerald-600 px-6 py-5 text-center text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-xl"
    >
      <span className="flex items-center justify-center gap-2 text-lg font-bold">
        💊 {name} 최저가 확인하기
      </span>
      <span className="block text-sm text-emerald-100 mt-1">
        약국별 실시간 가격 비교 →
      </span>
    </a>
  );
}
