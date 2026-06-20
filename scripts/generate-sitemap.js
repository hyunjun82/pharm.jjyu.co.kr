/**
 * 빌드 후 public/sitemap.xml 정적 생성
 * esbuild로 data/articles TS를 번들 → eval → XML 생성
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const BASE_URL = "https://pharm.jjyu.co.kr";
const ROOT = path.join(__dirname, "..");
const TMP = path.join(ROOT, "tmp-sitemap-bundle.cjs");

// 1) esbuild로 data/articles를 CJS 번들로 변환
console.log("📦 data/articles 번들링...");
execSync(
  `npx esbuild data/articles/build-all.ts --bundle --platform=node --format=cjs --outfile=${TMP} --external:react --external:next`,
  { cwd: ROOT, stdio: "inherit" }
);

// 2) 번들 로드
const { hubArticles, spokeArticles } = require(TMP);

// 3) XML 생성
const now = new Date().toISOString();

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(url, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const entries = [];

entries.push(urlEntry(BASE_URL, now, "weekly", "1.0"));
entries.push(urlEntry(`${BASE_URL}/about`, "2026-02-22", "monthly", "0.5"));

for (const hub of Object.values(hubArticles)) {
  entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(hub.categorySlug)}`, hub.dateModified, "weekly", "0.9"));
}

for (const hub of Object.values(hubArticles)) {
  entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/${encodeURIComponent("가격비교")}`, hub.dateModified, "weekly", "0.7"));
}

for (const [category, articles] of Object.entries(spokeArticles)) {
  for (const article of Object.values(articles)) {
    entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(article.slug)}`, article.dateModified, "monthly", "0.8"));
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

const outPath = path.join(ROOT, "public", "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf-8");

// 임시 번들 삭제
fs.unlinkSync(TMP);

console.log(`✅ sitemap.xml 생성 완료: ${entries.length}개 URL`);
