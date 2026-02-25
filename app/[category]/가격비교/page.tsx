import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ChevronRight } from "lucide-react";
import { categories } from "@/data/categories";
import { getProductsByCategory } from "@/data/products";
import type { Product } from "@/lib/types";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const catSlug = decodeURIComponent(category);
  const catInfo = categories.find((c) => c.slug === catSlug);
  if (!catInfo) return {};
  return {
    title: `${catInfo.name} 가격비교 | ${catInfo.description}`,
    description: `${catInfo.name} 전체 제품의 약국 기준가와 최저가를 한눈에 비교해요. 발키리 연동 제품은 약국별 실시간 가격 확인이 가능해요.`,
    alternates: {
      canonical: `https://pharm.jjyu.co.kr/${catSlug}/가격비교`,
    },
    openGraph: {
      title: `${catInfo.name} 가격비교 | ${catInfo.description}`,
      description: `${catInfo.name} 전체 제품의 약국 기준가와 최저가 비교`,
      url: `https://pharm.jjyu.co.kr/${catSlug}/가격비교`,
      siteName: "약정보",
      locale: "ko_KR",
    },
  };
}

function getBarkiriUrl(product: Product): string {
  if (product.barkiryProductId) return `https://barkiri.com/products/${product.barkiryProductId}`;
  if (product.externalSearchUrl) return product.externalSearchUrl;
  return `https://barkiri.com/search?query=${encodeURIComponent(product.barkiryQuery!)}`;
}

export default async function PriceComparePage({ params }: PageProps) {
  const { category } = await params;
  const catSlug = decodeURIComponent(category);
  const catInfo = categories.find((c) => c.slug === catSlug);
  if (!catInfo) notFound();

  const allProducts = getProductsByCategory(catSlug).sort((a, b) => a.price - b.price);
  const withBarkiri = allProducts.filter(
    (p) => p.barkiryProductId || p.externalSearchUrl || p.barkiryQuery
  );
  const withoutBarkiri = allProducts.filter(
    (p) => !p.barkiryProductId && !p.externalSearchUrl && !p.barkiryQuery
  );

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            <Link href="/" className="hover:text-emerald-600">홈</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/${catSlug}`} className="hover:text-emerald-600">{catInfo.name}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">가격비교</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="text-3xl mb-3">{catInfo.icon}</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {catInfo.name} 가격비교
          </h1>
          <p className="mt-2 text-base text-gray-500 leading-relaxed">
            {catInfo.name} 전체 제품의 약국 기준가를 한눈에 비교해요.
            발키리 연동 제품은 버튼을 눌러 약국별 실시간 최저가를 확인할 수 있어요.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 font-medium">
              최저가 비교 가능 {withBarkiri.length}개
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-gray-600 font-medium">
              기준가 참고 {withoutBarkiri.length}개
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Products WITH Barkiri */}
        {withBarkiri.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-1">약국 최저가 비교 가능</h2>
            <p className="text-sm text-gray-500 mb-4">아래 제품은 발키리에서 약국별 실시간 최저가를 확인할 수 있어요.</p>
            <div className="divide-y rounded-xl border overflow-hidden bg-white shadow-sm">
              {withBarkiri.map((product) => (
                <div key={product.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${catSlug}/${product.slug}`}
                      className="font-medium text-gray-900 hover:text-emerald-600 transition-colors"
                    >
                      {product.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                    <span className="text-xs text-gray-400">
                      기준가 {new Intl.NumberFormat("ko-KR").format(product.price)}원
                    </span>
                    <a
                      href={getBarkiriUrl(product)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                    >
                      최저가 <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Products WITHOUT Barkiri */}
        {withoutBarkiri.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-1">약국 기준가 참고</h2>
            <p className="text-sm text-gray-500 mb-4">아래 제품은 약국 판매 기준가 정보만 제공해요. 가격은 약국마다 다를 수 있어요.</p>
            <div className="divide-y rounded-xl border overflow-hidden bg-white shadow-sm">
              {withoutBarkiri.map((product) => (
                <div key={product.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${catSlug}/${product.slug}`}
                      className="font-medium text-gray-900 hover:text-emerald-600 transition-colors"
                    >
                      {product.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-gray-700">
                    {new Intl.NumberFormat("ko-KR").format(product.price)}원
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {allProducts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">아직 등록된 제품이 없어요.</p>
            <Link href={`/${catSlug}`} className="mt-4 inline-block text-sm text-emerald-600 hover:underline">
              {catInfo.name} 가이드 보기 →
            </Link>
          </div>
        )}

        <div className="mt-4 border-t pt-6">
          <Link
            href={`/${catSlug}`}
            className="text-sm text-gray-500 hover:text-emerald-600 transition-colors"
          >
            ← {catInfo.name} 가이드로 돌아가기
          </Link>
        </div>
      </div>

      {/* Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${catInfo.name} 가격비교`,
            description: `${catInfo.name} 전체 제품 약국 기준가 및 최저가 비교`,
            url: `https://pharm.jjyu.co.kr/${catSlug}/가격비교`,
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "홈", item: "https://pharm.jjyu.co.kr" },
                { "@type": "ListItem", position: 2, name: catInfo.name, item: `https://pharm.jjyu.co.kr/${catSlug}` },
                { "@type": "ListItem", position: 3, name: "가격비교", item: `https://pharm.jjyu.co.kr/${catSlug}/가격비교` },
              ],
            },
          }),
        }}
      />
    </>
  );
}
