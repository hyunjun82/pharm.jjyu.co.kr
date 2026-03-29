import { hubArticles, getSpokeIndex } from "@/data/articles";

const BASE_URL = "https://pharm.jjyu.co.kr";

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(url: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET() {
  const now = new Date().toISOString();
  const entries: string[] = [];

  // 정적 페이지
  entries.push(urlEntry(BASE_URL, now, "weekly", "1.0"));
  entries.push(urlEntry(`${BASE_URL}/about`, "2026-02-22", "monthly", "0.5"));

  // 허브 페이지
  for (const hub of Object.values(hubArticles)) {
    entries.push(urlEntry(
      `${BASE_URL}/${encodeURIComponent(hub.categorySlug)}`,
      hub.dateModified,
      "weekly",
      "0.9"
    ));
  }

  // 가격비교 페이지
  for (const hub of Object.values(hubArticles)) {
    entries.push(urlEntry(
      `${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/${encodeURIComponent("가격비교")}`,
      hub.dateModified,
      "weekly",
      "0.7"
    ));
  }

  // 스포크 페이지 (인덱스 JSON에서 읽기)
  const spokeIndex = await getSpokeIndex();
  for (const [category, articles] of Object.entries(spokeIndex)) {
    for (const article of Object.values(articles)) {
      entries.push(urlEntry(
        `${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(article.slug)}`,
        article.dateModified,
        "monthly",
        "0.8"
      ));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
