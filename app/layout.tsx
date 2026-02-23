import type { Metadata } from "next";
import { Noto_Sans_KR, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "약정보 - 일반의약품 최저가 비교 가이드",
    template: "%s | 약정보",
  },
  description:
    "일반의약품 최저가 비교, 성분 분석, 효능 가이드. 탈모약, 연고, 감기약, 진통제 등 의약품 정보를 한눈에.",
  keywords: ["일반의약품", "최저가", "약 가격 비교", "탈모약", "연고", "감기약"],
  openGraph: {
    title: "약정보 - 일반의약품 최저가 비교 가이드",
    description:
      "일반의약품 최저가 비교, 성분 분석, 효능 가이드. 탈모약, 연고, 감기약, 진통제 등 의약품 정보를 한눈에.",
    url: "https://pharm.jjyu.co.kr",
    siteName: "약정보",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "약정보 - 일반의약품 최저가 비교 가이드",
    description:
      "일반의약품 최저가 비교, 성분 분석, 효능 가이드. 탈모약, 연고, 감기약, 진통제 등 의약품 정보를 한눈에.",
  },
  alternates: {
    canonical: "https://pharm.jjyu.co.kr",
  },
  verification: {
    google: "kPe6sAN7cMBDG2OVVWHcI8hH-BxkT5Zv6U8TVWTxuwI",
    other: {
      "naver-site-verification": ["1ae236154d318ff542ba2858bb0d557f33834985"],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2442517902625121"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${notoSansKR.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Header />
        <main className="min-h-[calc(100vh-140px)]">{children}</main>
        <Footer />

        {/* #5 WebSite 스키마 - 사이트 검색창 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "약정보",
              url: "https://pharm.jjyu.co.kr",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate:
                    "https://pharm.jjyu.co.kr/search?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        {/* #6 Organization 스키마 - 브랜드 신뢰도 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "약정보",
              url: "https://pharm.jjyu.co.kr",
              logo: "https://pharm.jjyu.co.kr/logo.png",
              description:
                "공공데이터 기반 일반의약품 정보 플랫폼. 효능, 성분, 사용법, 최저가 비교 정보를 제공합니다.",
              sameAs: [],
            }),
          }}
        />

        {/* #9 Person 스키마 - E-E-A-T 전문성 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "의약품 에디터",
              url: "https://pharm.jjyu.co.kr/about",
              jobTitle: "의약품 정보 전문 에디터",
              description:
                "식약처 공공데이터 기반으로 일반의약품 성분, 효능, 부작용 정보를 전문적으로 분석하고 전달하는 에디터",
              worksFor: {
                "@type": "Organization",
                name: "약정보",
                url: "https://pharm.jjyu.co.kr",
              },
              knowsAbout: [
                "일반의약품(OTC) 성분 분석",
                "의약품 효능 및 부작용 분석",
                "탈모 케어 가이드",
                "복약 지도",
                "피부 질환 연고 분석",
                "의약품 가격 비교 데이터",
              ],
              sameAs: ["https://pharm.jjyu.co.kr/about"],
            }),
          }}
        />
      </body>
    </html>
  );
}
