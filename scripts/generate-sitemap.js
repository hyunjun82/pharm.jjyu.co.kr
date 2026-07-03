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

// 2026-07-03: 오염·미수리(NEEDS_REFETCH) 슬러그는 사이트맵에서 제외 — 틀린 정보 페이지의 색인 유도 중단 (수리되면 자동 복귀)
let EXCLUDE = new Set();
try {
  const imap = JSON.parse(fs.readFileSync(path.join(ROOT, "_workspace", "integrity-map.json"), "utf8"));
  EXCLUDE = new Set(imap.filter((x) => x.status === "NEEDS_REFETCH").map((x) => x.slug));
  console.log(`사이트맵 제외(NEEDS_REFETCH): ${EXCLUDE.size}건`);
} catch {}

const entries = [];

// ⚠️ trailingSlash: true 사이트이므로 모든 URL은 반드시 "/"로 끝나야 함.
//    슬래시 없는 URL은 전부 리디렉션 대상 → 구글 "리디렉션 페이지" 처리·네이버 수집 실패 유발
//    (커밋 031dad0에서 app/sitemap.ts만 고치고 이 파일이 누락됐던 회귀 버그 — 2026-07-02 수정)
entries.push(urlEntry(`${BASE_URL}/`, now, "weekly", "1.0"));
entries.push(urlEntry(`${BASE_URL}/about/`, "2026-02-22", "monthly", "0.5"));

for (const hub of Object.values(hubArticles)) {
  entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/`, hub.dateModified, "weekly", "0.9"));
}

for (const hub of Object.values(hubArticles)) {
  entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/${encodeURIComponent("가격비교")}/`, hub.dateModified, "weekly", "0.7"));
}

for (const [category, articles] of Object.entries(spokeArticles)) {
  for (const article of Object.values(articles)) {
    if (EXCLUDE.has(article.slug)) continue;
    entries.push(urlEntry(`${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(article.slug)}/`, article.dateModified, "monthly", "0.8"));
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

const outPath = path.join(ROOT, "public", "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf-8");

// 임시 번들 삭제 (실패해도 사이트맵 생성엔 무관하므로 무시)
try {
  fs.unlinkSync(TMP);
} catch {}

console.log(`✅ sitemap.xml 생성 완료: ${entries.length}개 URL`);
