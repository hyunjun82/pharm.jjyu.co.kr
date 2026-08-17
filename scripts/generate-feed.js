/**
 * public/feed.xml (RSS 2.0) 정적 생성 — 네이버 서치어드바이저 RSS 제출용
 * layout.tsx <head>에서 /feed.xml을 참조하지만 실제 파일이 없어 404였던 문제 해결 (2026-07-02)
 * 사용: node scripts/generate-feed.js  (generate-sitemap.js와 동일하게 esbuild 번들 사용)
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const BASE_URL = "https://pharm.jjyu.co.kr";
const ROOT = path.join(__dirname, "..");
const TMP = path.join(ROOT, "tmp-feed-bundle.cjs");
const MAX_ITEMS = 30; // 2026-08-12: 본문 전체를 싣게 되어 용량 제한 대비 50→30

console.log("📦 data/articles 번들링...");
execSync(
  `npx esbuild data/articles/build-all.ts --bundle --platform=node --format=cjs --outfile=${TMP} --external:react --external:next`,
  { cwd: ROOT, stdio: "inherit" }
);

const { spokeArticles } = require(TMP);

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 본문 텍스트를 RSS content:encoded용 HTML로. CDATA로 감싸므로 escape 불필요하되
// "]]>" 시퀀스만 깨뜨려 CDATA 조기 종료를 막는다.
function toHtml(text) {
  return String(text || "")
    .replace(/]]>/g, "]]&gt;")
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

// RFC-822 pubDate (네이버 RSS 규격) — 날짜만 있는 경우 09:00 KST로 간주
function toPubDate(d) {
  const date = new Date(`${d}T00:00:00+09:00`);
  return isNaN(date) ? new Date().toUTCString() : date.toUTCString();
}

// 전체 스포크를 dateModified 내림차순 정렬 후 상위 MAX_ITEMS
const all = [];
for (const [category, articles] of Object.entries(spokeArticles)) {
  for (const a of Object.values(articles)) {
    all.push({
      title: a.title,
      link: `${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(a.slug)}/`,
      description: a.metaDescription || a.description || "",
      date: a.dateModified || a.datePublished,
      // 2026-08-12: 네이버 서치어드바이저 RSS 도움말 —
      //   "RSS 피드 내의 콘텐츠는 이미지 링크가 포함된 본문 전체를 제공하는 것을 권장합니다."
      //   기존에는 metaDescription(120자)만 보내 네이버가 본문을 못 봤다.
      body: [
        a.heroDescription || "",
        ...(a.sections || []).map((s) => `${s.title}\n${s.content}`),
        ...(a.faq || []).map((f) => `${f.question || f.q || ""}\n${f.answer || f.a || ""}`),
      ].filter(Boolean).join("\n\n"),
    });
  }
}
all.sort((x, y) => String(y.date).localeCompare(String(x.date)));
const items = all.slice(0, MAX_ITEMS);

const itemXml = items
  .map(
    (i) => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(i.link)}</link>
      <guid isPermaLink="true">${escapeXml(i.link)}</guid>
      <description>${escapeXml(i.description)}</description>
      <content:encoded><![CDATA[${toHtml(i.body)}]]></content:encoded>
      <pubDate>${toPubDate(i.date)}</pubDate>
    </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>약정보 - 일반의약품 최저가 비교 가이드</title>
    <link>${BASE_URL}/</link>
    <description>일반의약품 최저가 비교, 성분 분석, 효능 가이드. 식약처 공공데이터 기반 의약품 정보.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemXml}
  </channel>
</rss>`;

fs.writeFileSync(path.join(ROOT, "public", "feed.xml"), xml, "utf-8");

try {
  fs.unlinkSync(TMP);
} catch {}

console.log(`✅ feed.xml 생성 완료: ${items.length}개 아이템 (최신 dateModified 순)`);
