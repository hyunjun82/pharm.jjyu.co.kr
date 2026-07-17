/**
 * Layer 1: Source Gate — 소스 JSON 존재·스키마·신선도·중복 검증
 *
 * 사용법:
 *   node scripts/verify-source.js              전체 검증
 *   node scripts/verify-source.js --slug 마데카솔  특정 slug만
 *   node scripts/verify-source.js --fix         만료 소스 목록 출력
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const SCHEMA_FILE = path.join(SOURCE_DIR, "schema.json");
const CONFIG_FILE = path.join(__dirname, "quality-config.json");

function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
  const showFix = args.includes("--fix");

  console.log("=== Layer 1: Source Gate ===\n");

  // 로드
  if (!fs.existsSync(SOURCE_MAP)) {
    console.error("source-map.json 없음. fetch-source.js 먼저 실행하세요.");
    process.exit(1);
  }
  const sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP, "utf8"));
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const maxAgeDays = config.freshness.maxAgeDays;
  const today = new Date();

  const entries = Object.entries(sourceMap).filter(([k]) => k !== "_meta");
  const toCheck = singleSlug ? entries.filter(([k]) => k === singleSlug) : entries;

  let pass = 0;
  let fail = 0;
  const errors = [];
  const expired = [];
  const canonicalUrls = new Map();

  for (const [slug, entry] of toCheck) {
    const errs = [];

    // 1. 소스 파일 존재 확인
    if (!entry.sourceFile) {
      errs.push("소스 파일 없음 (unmapped)");
    } else {
      const filePath = path.join(SOURCE_DIR, entry.sourceFile);
      if (!fs.existsSync(filePath)) {
        errs.push(`소스 파일 실재 안 함: ${entry.sourceFile}`);
      } else {
        // 2. JSON 파싱 + 스키마 검증
        let sourceData;
        try {
          sourceData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (e) {
          errs.push(`JSON 파싱 실패: ${e.message}`);
        }

        if (sourceData) {
          // 필수 필드
          for (const field of schema.requiredFields) {
            if (!sourceData[field] || String(sourceData[field]).trim() === "") {
              errs.push(`필수 필드 누락: ${field}`);
            }
          }

          // 필드 타입
          for (const [field, type] of Object.entries(schema.fieldTypes)) {
            if (sourceData[field] !== undefined && sourceData[field] !== null && sourceData[field] !== "") {
              if (typeof sourceData[field] !== type) {
                errs.push(`타입 불일치: ${field} (${typeof sourceData[field]} != ${type})`);
              }
            }
          }

          // 최소 길이
          if (schema.minContentLength) {
            for (const [field, minLen] of Object.entries(schema.minContentLength)) {
              if (sourceData[field] && sourceData[field].length < minLen) {
                errs.push(`내용 부족: ${field} (${sourceData[field].length}자 < ${minLen}자)`);
              }
            }
          }

          // 3. 신선도 (fetchedAt 기준 N일 이내)
          if (sourceData.fetchedAt) {
            const fetched = new Date(sourceData.fetchedAt);
            const diffDays = Math.floor((today - fetched) / (1000 * 60 * 60 * 24));
            if (diffDays > maxAgeDays) {
              errs.push(`소스 만료: ${diffDays}일 경과 (${maxAgeDays}일 제한)`);
              expired.push({ slug, category: entry.category, days: diffDays });
            }
          } else {
            errs.push("fetchedAt 없음");
          }
        }
      }
    }

    // 4. canonicalUrl 중복 확인
    if (entry.canonicalUrl) {
      if (canonicalUrls.has(entry.canonicalUrl)) {
        errs.push(`canonicalUrl 중복: ${entry.canonicalUrl} (${canonicalUrls.get(entry.canonicalUrl)}과 동일)`);
      } else {
        canonicalUrls.set(entry.canonicalUrl, slug);
      }
    }

    if (errs.length > 0) {
      fail++;
      errors.push({ slug, category: entry.category, errors: errs });
    } else {
      pass++;
    }
  }

  // 결과 출력
  const unmappedCount = toCheck.filter(([, v]) => v.sourceType === "unmapped").length;
  const mappedErrors = errors.filter((e) => !e.errors.includes("소스 파일 없음 (unmapped)"));

  if (mappedErrors.length > 0) {
    console.log(`[ERROR] 매핑된 소스 중 오류 ${mappedErrors.length}건:\n`);
    for (const e of mappedErrors) {
      for (const err of e.errors) {
        console.log(`  [${e.category}/${e.slug}] ${err}`);
      }
    }
  }

  if (showFix && expired.length > 0) {
    console.log(`\n[FIX] 만료 소스 ${expired.length}건 (재다운로드 필요):\n`);
    for (const e of expired) {
      console.log(`  ${e.category}/${e.slug} — ${e.days}일 경과`);
    }
  }

  console.log("\n=== Source Gate 결과 ===");
  console.log(`총 검사:       ${toCheck.length}개`);
  console.log(`PASS:          ${pass}개`);
  console.log(`FAIL (매핑됨): ${mappedErrors.length}개`);
  console.log(`미매핑:        ${unmappedCount}개`);
  console.log(`만료:          ${expired.length}개`);

  if (mappedErrors.length === 0) {
    console.log("\nLayer 1 Source Gate PASS");
  } else {
    console.log("\nLayer 1 Source Gate FAIL");
    process.exit(1);
  }
}

main();
