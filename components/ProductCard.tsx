import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  barkiryQuery: string;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ProductCard({ product }: { product: Product }) {
  const formattedPrice = new Intl.NumberFormat("ko-KR").format(product.price);
  const barkiryUrl = `https://barkiri.com/search?query=${encodeURIComponent(product.barkiryQuery)}`;

  return (
    <Card className="group overflow-hidden border border-gray-200 py-0 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-300">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <Badge className="absolute left-3 top-3 bg-emerald-600 text-white hover:bg-emerald-600 text-xs">
          {product.category}
        </Badge>
      </div>

      <CardContent className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 leading-snug">
            {product.name}
          </h3>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed line-clamp-2">
            {product.description}
          </p>
        </div>

        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              {formattedPrice}
            </span>
            <span className="text-sm font-medium text-gray-500">원</span>
            <span className="text-xs text-gray-400">/ {product.unit}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {getTodayString()} 기준 최저가
          </p>
        </div>

        <a
          href={barkiryUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <Button className="group/btn w-full bg-emerald-600 text-white font-semibold text-sm py-5 shadow-md transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
            최저가 바로가기
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
