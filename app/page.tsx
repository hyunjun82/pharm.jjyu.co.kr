import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { spokeArticles } from "@/data/articles";
import { Search } from "lucide-react";

export default function HomePage() {
  const popularProducts = products.slice(0, 6);

  return (
    <>
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm text-emerald-700 mb-6">
            <Search className="h-3.5 w-3.5" />
            공공데이터 기반 의약품 정보
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            일반의약품 최저가 비교
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500 sm:text-lg">
            연고, 탈모약, 감기약, 진통제 등 일반의약품의 효능, 성분, 사용법을
            한눈에 비교하고 최저가로 구매하세요.
          </p>
        </div>
      </section>

      {/* Categories Section */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          카테고리별 의약품 가이드
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.slug}
              category={{
                ...cat,
                count: Object.keys(spokeArticles[cat.slug] ?? {}).length,
              }}
            />
          ))}
        </div>
      </section>

      {/* Popular Products Section */}
      <section className="border-t bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            인기 의약품 최저가
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Info Banner */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8">
            <h2 className="text-lg font-bold text-emerald-900">
              약 가격, 약국마다 다릅니다
            </h2>
            <p className="mt-2 text-sm text-emerald-700">
              같은 약이라도 약국마다 가격 차이가 큽니다. 발키리에서 내 주변
              최저가 약국을 확인하세요.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
