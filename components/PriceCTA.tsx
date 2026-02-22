import { ExternalLink } from "lucide-react";

interface PriceCTAProps {
  name: string;
  barkiryQuery: string;
}

export function PriceCTA({ name, barkiryQuery }: PriceCTAProps) {
  const barkiryUrl = `https://barkiri.com/search?query=${encodeURIComponent(barkiryQuery)}`;

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
        바키리에서 약국별 실시간 가격 비교
      </span>
    </a>
  );
}
