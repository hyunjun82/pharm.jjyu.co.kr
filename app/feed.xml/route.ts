import { hubArticles, spokeArticles } from "@/data/articles";

const BASE_URL = "https://pharm.jjyu.co.kr";

export async function GET() {
  const allItems: { title: string; url: string; description: string; date: string }[] = [];

  // Hub articles
  for (const hub of Object.values(hubArticles)) {
    allItems.push({
      title: hub.title,
      url: `${BASE_URL}/${encodeURIComponent(hub.categorySlug)}`,
      description: hub.metaDescription,
      date: hub.dateModified || hub.datePublished || "2026-02-22",
    });
  }

  // Spoke articles
  for (const [category, articles] of Object.entries(spokeArticles)) {
    for (const article of Object.values(articles)) {
      allItems.push({
        title: article.title,
        url: `${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(article.slug)}`,
        description: article.metaDescription,
        date: article.dateModified || article.datePublished || "2026-02-22",
      });
    }
  }

  // Sort by date descending
  allItems.sort((a, b) => b.date.localeCompare(a.date));

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const rssItems = allItems
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>약정보 - 일반의약품 최저가 비교 가이드</title>
    <link>${BASE_URL}</link>
    <description>일반의약품 최저가 비교, 성분 분석, 효능 가이드. 탈모약, 연고, 감기약, 진통제 등 의약품 정보를 한눈에.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
