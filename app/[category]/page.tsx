import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { getHubArticle } from "@/data/articles";
import { getProductsByCategory } from "@/data/products";
import { categories } from "@/data/categories";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return categories.map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const slug = decodeURIComponent(category);
  const hub = getHubArticle(slug);
  if (!hub) return {};
  return {
    title: hub.title,
    description: hub.metaDescription,
    openGraph: {
      title: hub.title,
      description: hub.metaDescription,
      url: `https://pharm.jjyu.co.kr/${slug}`,
      siteName: "약정보",
      locale: "ko_KR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: hub.title,
      description: hub.metaDescription,
    },
    alternates: {
      canonical: `https://pharm.jjyu.co.kr/${slug}`,
    },
  };
}

export default async function HubPage({ params }: PageProps) {
  const { category } = await params;
  const slug = decodeURIComponent(category);
  const hub = getHubArticle(slug);
  const catInfo = categories.find((c) => c.slug === slug);

  if (!hub || !catInfo) notFound();

  const categoryProducts = getProductsByCategory(slug);

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            <Link href="/" className="hover:text-emerald-600">
              홈
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">{catInfo.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 mb-4">
            {catInfo.icon} {catInfo.name} 가이드
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {hub.h1}
          </h1>
          <p className="mt-3 text-base text-gray-500 leading-relaxed max-w-2xl">
            {hub.heroDescription}
          </p>
        </div>
      </section>

      {/* Spoke Articles List */}
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          상세 가이드
        </h2>
        <div className="grid gap-3">
          {hub.spokes.map((spoke) => (
            <Link
              key={spoke.slug}
              href={`/${slug}/${spoke.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  {spoke.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {spoke.description}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 group-hover:text-emerald-600 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Products Grid */}
      {categoryProducts.length > 0 && (
        <section className="border-t bg-gray-50/50">
          <div className="mx-auto max-w-4xl px-4 py-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {catInfo.name} 최저가 비교
              </h2>
              <Link
                href={`/${slug}/가격비교`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                💰 전체 가격비교
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back Link */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          전체 카테고리 보기
        </Link>
      </div>

      {/* #3 BreadcrumbList 스키마 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "홈", item: "https://pharm.jjyu.co.kr" },
              { "@type": "ListItem", position: 2, name: catInfo.name, item: `https://pharm.jjyu.co.kr/${slug}` },
            ],
          }),
        }}
      />

      {/* #8 ItemList 스키마 - Hub 페이지 목차 리스트 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${catInfo.name} 가이드`,
            description: hub.description,
            numberOfItems: hub.spokes.length,
            itemListElement: hub.spokes.map((spoke, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              name: spoke.title,
              url: `https://pharm.jjyu.co.kr/${slug}/${spoke.slug}`,
            })),
          }),
        }}
      />
    </>
  );
}
