import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { FAQSection } from "@/components/FAQSection";
import { AdSlot } from "@/components/AdSlot";
import { getSpokeArticle } from "@/data/articles";
import { getProductsByCategory } from "@/data/products";
import { spokeArticles } from "@/data/articles";
import { categories } from "@/data/categories";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  const allParams: { category: string; slug: string }[] = [];
  for (const [categorySlug, spokes] of Object.entries(spokeArticles)) {
    for (const spokeSlug of Object.keys(spokes)) {
      allParams.push({ category: categorySlug, slug: spokeSlug });
    }
  }
  return allParams;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const catSlug = decodeURIComponent(category);
  const spokeSlug = decodeURIComponent(slug);
  const article = getSpokeArticle(catSlug, spokeSlug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
  };
}

export default async function SpokePage({ params }: PageProps) {
  const { category, slug } = await params;
  const catSlug = decodeURIComponent(category);
  const spokeSlug = decodeURIComponent(slug);
  const article = getSpokeArticle(catSlug, spokeSlug);
  const catInfo = categories.find((c) => c.slug === catSlug);

  if (!article || !catInfo) notFound();

  const relatedProducts = getProductsByCategory(catSlug).filter(
    (p) => p.slug !== spokeSlug
  );

  const mainProduct = article.products[0];

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
            <Link href={`/${catSlug}`} className="hover:text-emerald-600">
              {catInfo.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">{spokeSlug}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 mb-4">
            {catInfo.icon} {catInfo.name}
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {article.title}
          </h1>
          <p className="mt-3 text-base text-gray-500 leading-relaxed sm:text-lg">
            {article.heroDescription}
          </p>
        </div>
      </section>

      {/* Main Product Card */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        {article.products.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {article.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Ad: 본문 진입 전 */}
      <div className="mx-auto max-w-3xl px-4">
        <AdSlot id="content-top" />
      </div>

      {/* Article Sections */}
      <article className="mx-auto max-w-3xl px-4">
        {article.sections.map((section, i) => (
          <section key={i} className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {section.title}
            </h2>
            <p className="text-[16px] text-gray-600 leading-[1.85] sm:text-[17px]">
              {section.content}
            </p>
            {i < article.sections.length - 1 && <Separator className="mt-10" />}
            {/* 섹션 중간 광고: 첫 번째 섹션 뒤 */}
            {i === 0 && <AdSlot id="content-mid" />}
          </section>
        ))}
      </article>

      {/* FAQ */}
      {article.faq.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pb-4">
          <FAQSection items={article.faq} />
        </div>
      )}

      {/* Ad: FAQ 아래 */}
      <div className="mx-auto max-w-3xl px-4">
        <AdSlot id="after-faq" />
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="border-t bg-gray-50/50 mt-4">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              같은 카테고리 다른 의약품
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {relatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back Links */}
      <div className="mx-auto max-w-3xl px-4 py-8 flex gap-4">
        <Link
          href={`/${catSlug}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {catInfo.name} 가이드로 돌아가기
        </Link>
      </div>

      {/* #1 Article 스키마 - 기본 글 정보 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.description,
            image: mainProduct?.image
              ? `https://pharm.jjyu.co.kr${mainProduct.image}`
              : undefined,
            author: {
              "@type": "Person",
              name: "약정보 에디터",
              url: "https://pharm.jjyu.co.kr/about",
            },
            publisher: {
              "@type": "Organization",
              name: "약정보",
              logo: {
                "@type": "ImageObject",
                url: "https://pharm.jjyu.co.kr/logo.png",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://pharm.jjyu.co.kr/${catSlug}/${spokeSlug}`,
            },
          }),
        }}
      />

      {/* #2 FAQPage 스키마 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: article.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />

      {/* #3 BreadcrumbList 스키마 */}
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
                name: catInfo.name,
                item: `https://pharm.jjyu.co.kr/${catSlug}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: spokeSlug,
                item: `https://pharm.jjyu.co.kr/${catSlug}/${spokeSlug}`,
              },
            ],
          }),
        }}
      />

      {/* #4 HowTo 스키마 - 단계별 사용법 */}
      {article.sections.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              name: `${spokeSlug} 올바른 사용법`,
              description: article.description,
              step: article.sections.map((section, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: section.title,
                text: section.content,
              })),
            }),
          }}
        />
      )}

      {/* #10 Drug 스키마 - 의약품 상세 정보 (CTR 향상 핵심) */}
      {mainProduct && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Drug",
              name: mainProduct.name,
              description: mainProduct.description,
              image: mainProduct.image
                ? `https://pharm.jjyu.co.kr${mainProduct.image}`
                : undefined,
              activeIngredient: mainProduct.ingredients || undefined,
              indication: mainProduct.description,
              administrationRoute: "경구 또는 외용",
              url: `https://pharm.jjyu.co.kr/${catSlug}/${spokeSlug}`,
              offers: {
                "@type": "Offer",
                price: mainProduct.price,
                priceCurrency: "KRW",
                availability: "https://schema.org/InStock",
              },
            }),
          }}
        />
      )}
    </>
  );
}
