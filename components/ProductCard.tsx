import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  barkiryQuery: string;
  barkiryProductId?: string;
  externalSearchUrl?: string;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ProductCard({ product }: { product: Product }) {
  const formattedPrice = new Intl.NumberFormat("ko-KR").format(product.price);
  const barkiryUrl = product.barkiryProductId
    ? `https://barkiri.com/products/${product.barkiryProductId}`
    : product.externalSearchUrl
      ? product.externalSearchUrl
      : `https://barkiri.com/search?query=${encodeURIComponent(product.barkiryQuery)}`;

  return (
    <a
      href={barkiryUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="block"
    >
      <Card className="group overflow-hidden border border-gray-200 py-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-300 cursor-pointer">
        <div className="flex items-center gap-4 p-4">
          {/* 이미지: 컴팩트 정사각형 */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-2"
              sizes="80px"
            />
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] px-1.5 py-0">
                {product.category}
              </Badge>
            </div>
            <h3 className="mt-1 text-sm font-bold text-gray-900 leading-snug truncate">
              {product.name}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
              {product.description}
            </p>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-emerald-600">
                {formattedPrice}
              </span>
              <span className="text-xs text-gray-500">원</span>
              <span className="text-[10px] text-gray-400">/ {product.unit}</span>
              <span className="ml-auto text-[10px] text-gray-400">
                {getTodayString()} 기준
              </span>
            </div>
          </div>

        </div>

        {/* CTA 바 */}
        <div className="flex items-center justify-center gap-1.5 border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
          💊 최저가 확인 →
        </div>
      </Card>
    </a>
  );
}
