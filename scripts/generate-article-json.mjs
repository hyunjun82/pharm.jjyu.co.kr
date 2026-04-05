/**
 * 빌드 전 실행: spoke 데이터를 public/data/ 아래 JSON으로 분리
 * Worker 번들 크기를 줄여 Cloudflare 배포 시 모든 페이지 동작하게 함
 *
 * 사용법: node scripts/generate-article-json.mjs
 * 빌드 스크립트에서 자동 호출됨
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TMP_BUNDLE = join(ROOT, ".tmp-articles-bundle.cjs");
const OUT_DIR = join(ROOT, "public", "data");

// 1) esbuild로 data/articles/index.ts → CJS 번들 변환
console.log("📦 data/articles/build-all 번들링...");
execSync(
  `npx esbuild data/articles/build-all.ts --bundle --platform=node --format=cjs --outfile=${TMP_BUNDLE} --external:react --external:next --log-level=warning`,
  { cwd: ROOT, stdio: "inherit" }
);

// 2) 번들 로드
const mod = await import(`file://${TMP_BUNDLE}`);
// CJS default export 처리
const { hubArticles, spokeArticles } = mod.default || mod;

// 3) 기존 public/data 삭제 후 재생성
if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}

// 4) 각 spoke를 개별 JSON으로 저장
let totalCount = 0;
for (const [category, articles] of Object.entries(spokeArticles)) {
  const catDir = join(OUT_DIR, category);
  mkdirSync(catDir, { recursive: true });

  for (const [slug, article] of Object.entries(articles)) {
    const filePath = join(catDir, `${slug}.json`);
    writeFileSync(filePath, JSON.stringify(article), "utf-8");
    totalCount++;
  }
}

// 5) spoke 인덱스 생성 (sitemap + home page용)
// slug, dateModified만 포함 → 수십 KB 수준
const spokeIndex = {};
for (const [category, articles] of Object.entries(spokeArticles)) {
  spokeIndex[category] = {};
  for (const [slug, article] of Object.entries(articles)) {
    spokeIndex[category][slug] = {
      slug: article.slug,
      dateModified: article.dateModified,
    };
  }
}
writeFileSync(join(OUT_DIR, "spoke-index.json"), JSON.stringify(spokeIndex), "utf-8");

// 6) hub 인덱스 생성 (home page 카테고리별 개수용)
const hubIndex = {};
for (const [category, hub] of Object.entries(hubArticles)) {
  hubIndex[category] = {
    spokeCount: Object.keys(spokeArticles[category] || {}).length,
  };
}
writeFileSync(join(OUT_DIR, "hub-index.json"), JSON.stringify(hubIndex), "utf-8");

// 7) sitemap.xml 생성
const BASE_URL = "https://pharm.jjyu.co.kr";
const now = new Date().toISOString();

function urlEntry(url, lastmod, changefreq, priority) {
  const escaped = url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `  <url>\n    <loc>${escaped}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const entries = [];
entries.push(urlEntry(BASE_URL, now, "weekly", "1.0"));
entries.push(urlEntry(`${BASE_URL}/about`, "2026-02-22", "monthly", "0.5"));

for (const [cat, hub] of Object.entries(hubArticles)) {
  entries.push(urlEntry(
    `${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/`,
    hub.dateModified || now,
    "weekly",
    "0.9"
  ));
  entries.push(urlEntry(
    `${BASE_URL}/${encodeURIComponent(hub.categorySlug)}/${encodeURIComponent("가격비교")}/`,
    hub.dateModified || now,
    "weekly",
    "0.7"
  ));
}

for (const [category, articles] of Object.entries(spokeArticles)) {
  for (const [slug, article] of Object.entries(articles)) {
    entries.push(urlEntry(
      `${BASE_URL}/${encodeURIComponent(category)}/${encodeURIComponent(article.slug)}/`,
      article.dateModified || now,
      "monthly",
      "0.8"
    ));
  }
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
writeFileSync(join(ROOT, "public", "sitemap.xml"), sitemapXml, "utf-8");

// 8) 임시 번들 삭제
rmSync(TMP_BUNDLE, { force: true });

console.log(`✅ JSON 생성 완료: ${totalCount}개 spoke + sitemap.xml + 인덱스 파일`);
