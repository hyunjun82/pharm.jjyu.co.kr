/**
 * pharm-jjyu source-map 재생성 (file-scan 기반, API 캐시 의존 없음)
 *
 * 사용법:
 *   node scripts/rebuild-source-map.js
 *
 * 동작:
 *   1. data/articles/*.ts에서 모든 spoke slug 추출
 *   2. source-data/{slug}.json 존재 여부 확인
 *   3. schema.json으로 각 source 유효성 검증
 *   4. source-map.json 생성 (mapped/unmapped/schemaErrors 통계 포함)
 *
 * 이유:
 *   fetch-source.js는 tmp/edrug-all.json 캐시 필요. 캐시 없으면 동작 안 함.
 *   source-data/*.json 4,556개가 이미 존재하므로 map만 재생성하면 검증 인프라 부활.
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const SCHEMA_FILE = path.join(SOURCE_DIR, "schema.json");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");

function extractAllSpokeSlugs() {
  const slugs = [];
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "build-all.ts");

  for (const f of files) {
    const cat = f.replace(/\.ts$/, "").replace(/-\d+$/, "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const sectionMatches = [...content.matchAll(/sections:\s*\[/g)];

    for (const sm of sectionMatches) {
      const before = content.substring(Math.max(0, sm.index - 2000), sm.index);
      const slugM = [...before.matchAll(/slug:\s*"([^"]+)"/g)];
      if (slugM.length > 0) {
        slugs.push({ cat, slug: slugM[slugM.length - 1][1] });
      }
    }
  }
  return slugs;
}

function validateSchema(data, schema) {
  const errors = [];
  for (const field of schema.requiredFields) {
    if (!data[field] || String(data[field]).trim() === "") {
      errors.push(`${field} 누락`);
    }
  }
  if (schema.minContentLength) {
    for (const [field, minLen] of Object.entries(schema.minContentLength)) {
      if (data[field] && String(data[field]).length < minLen) {
        errors.push(`${field} 길이부족(${data[field].length}<${minLen})`);
      }
    }
  }
  return errors;
}

function main() {
  console.log("=== rebuild-source-map.js ===\n");

  console.log("1. spoke slug 추출...");
  const allSlugs = extractAllSpokeSlugs();
  console.log(`   ${allSlugs.length}개 spoke 발견\n`);

  console.log("2. schema 로드...");
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
  console.log(`   requiredFields: ${schema.requiredFields.length}개\n`);

  console.log("3. source-data 스캔 + 검증...");
  const today = new Date().toISOString().split("T")[0];
  const sourceMap = {
    _meta: {
      project: "pharm-jjyu",
      totalArticles: allSlugs.length,
      totalMapped: 0,
      totalUnmapped: 0,
      schemaErrorCount: 0,
      lastFullSync: today,
      sourceFreshnessLimit: 90,
      method: "rebuild-source-map.js (file-scan, no API)",
    },
  };

  let mapped = 0;
  let unmapped = 0;
  let schemaErrorCount = 0;
  const unmappedList = [];

  for (const { cat, slug } of allSlugs) {
    const sourceFile = path.join(SOURCE_DIR, `${slug}.json`);
    if (fs.existsSync(sourceFile)) {
      let data = null;
      let errors = [];
      try {
        data = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
        errors = validateSchema(data, schema);
      } catch (e) {
        errors = [`JSON parse fail: ${e.message}`];
      }
      if (errors.length > 0) schemaErrorCount++;

      sourceMap[slug] = {
        sourceFile: `${slug}.json`,
        sourceType: (data && data.sourceType) || "unknown",
        sourceOrigin: (data && data.sourceOrigin) || "",
        fetchedAt: (data && data.fetchedAt) || "",
        category: cat,
        canonicalUrl: `/${cat}/${slug}`,
        verified: errors.length === 0,
        itemName: (data && data.itemName) || "",
        schemaErrors: errors.length > 0 ? errors : undefined,
      };
      mapped++;
    } else {
      sourceMap[slug] = {
        sourceFile: null,
        sourceType: "unmapped",
        category: cat,
        canonicalUrl: `/${cat}/${slug}`,
        verified: false,
        reason: `source-data/${slug}.json 미존재`,
      };
      unmapped++;
      unmappedList.push(`${cat}/${slug}`);
    }
  }

  sourceMap._meta.totalMapped = mapped;
  sourceMap._meta.totalUnmapped = unmapped;
  sourceMap._meta.schemaErrorCount = schemaErrorCount;

  fs.writeFileSync(SOURCE_MAP, JSON.stringify(sourceMap, null, 2), "utf8");

  console.log("\n=== 결과 ===");
  console.log(`총 spoke:      ${allSlugs.length}개`);
  console.log(`매핑 성공:     ${mapped} (${((mapped / allSlugs.length) * 100).toFixed(1)}%)`);
  console.log(`매핑 실패:     ${unmapped}`);
  console.log(`스키마 경고:   ${schemaErrorCount}`);

  if (unmappedList.length > 0 && unmappedList.length <= 30) {
    console.log("\n매핑 실패 목록:");
    unmappedList.forEach((u) => console.log(`  - ${u}`));
  } else if (unmappedList.length > 30) {
    console.log(`\n매핑 실패 목록 (처음 30개):`);
    unmappedList.slice(0, 30).forEach((u) => console.log(`  - ${u}`));
    console.log(`  ... 외 ${unmappedList.length - 30}개`);
  }

  console.log(`\nsource-map.json 재생성 완료 (${SOURCE_MAP})`);
}

main();
