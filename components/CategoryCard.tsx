import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export interface Category {
  name: string;
  slug: string;
  icon: string;
  description: string;
  count: number;
}

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={`/${category.slug}`}>
      <Card className="group cursor-pointer border border-gray-200 py-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-emerald-200">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-3xl transition-colors group-hover:bg-emerald-100">
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900">{category.name}</h3>
            <p className="mt-0.5 text-sm text-gray-500 truncate">
              {category.description}
            </p>
            <span className="mt-1 inline-block text-xs text-emerald-600 font-medium">
              {category.count}개 의약품 정보
            </span>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-emerald-600" />
        </CardContent>
      </Card>
    </Link>
  );
}
