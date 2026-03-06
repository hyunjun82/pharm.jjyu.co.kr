/**
 * pharm-jjyu Source Gate: e약은요 API 데이터 → 개별 source JSON 분리 + source-map 생성
 *
 * 사용법:
 *   node scripts/fetch-source.js              전체 실행 (edrug-all.json → 개별 파일 + source-map)
 *   node scripts/fetch-source.js --refresh     API에서 최신 데이터 재다운로드 후 실행
 *   node scripts/fetch-source.js --slug 마데카솔  특정 slug만 생성
 *   node scripts/fetch-source.js --stats       통계만 출력
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const SCHEMA_FILE = path.join(SOURCE_DIR, "schema.json");
const EDRUG_CACHE = path.resolve(__dirname, "..", "tmp", "edrug-all.json");
const ALL_SLUGS = path.resolve(__dirname, "..", "tmp", "all-slugs.json");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const PRODUCTS_DIR = path.resolve(__dirname, "..", "data", "products");

// ── 글에서 모든 spoke slug 추출 ─────────────────────────────────
function extractAllSpokeSlugs() {
  const slugs = [];
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");

  for (const f of files) {
    const cat = f.replace(".ts", "");
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

// ── 제품 데이터에서 slug → itemName 매핑 (검색 키워드) ────────────
function buildProductNameMap() {
  const map = new Map();
  const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");

  for (const f of files) {
    const content = fs.readFileSync(path.join(PRODUCTS_DIR, f), "utf8");
    const blocks = content.split(/\n\s*\{/).slice(1);

    for (const block of blocks) {
      const slugM = block.match(/slug:\s*"([^"]+)"/);
      const nameM = block.match(/name:\s*"([^"]+)"/);
      if (slugM && nameM) {
        map.set(slugM[1], nameM[1]);
      }
    }
  }
  return map;
}

// ── e약은요 데이터 로드 ─────────────────────────────────────────
function loadEdrugData() {
  if (!fs.existsSync(EDRUG_CACHE)) {
    console.error("e약은요 캐시 없음:", EDRUG_CACHE);
    console.error("먼저 API에서 데이터를 다운로드하세요.");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(EDRUG_CACHE, "utf8"));
  const items = raw.body?.items || raw;
  return Array.isArray(items) ? items : [items];
}

// ── 문자열 정규화 (매칭용) ───────────────────────────────────────
function normalize(str) {
  return str
    .replace(/[\s\-·・()（）\[\]]/g, "")
    .replace(/밀리그람|밀리그램|mg/gi, "mg")
    .replace(/그램|g$/gi, "g")
    .toLowerCase();
}

// ── e약은요 데이터에서 slug에 맞는 항목 찾기 ────────────────────
function findEdrugItem(items, slug, productName) {
  const normSlug = normalize(slug);

  // 1순위: slug 정규화 매칭 (공백/하이픈 제거 후)
  const byNorm = items.find((x) => {
    if (!x.itemName) return false;
    const normItem = normalize(x.itemName);
    return normItem.includes(normSlug) || normSlug.includes(normItem.replace(/\(.*\)/, ""));
  });
  if (byNorm) return byNorm;

  // 2순위: 제품명에서 핵심 이름 추출 후 매칭
  if (productName) {
    // "마데카솔 연고 10g" → "마데카솔"
    // "타이레놀 콜드에스정 10정" → "타이레놀콜드에스"
    const baseName = productName
      .replace(/\s*\d+\s*(정|캡슐|포|개|ml|mL|g|mg|병|매|장|팩|세트).*$/i, "")
      .replace(/\s*(연고|겔|크림|액|산|시럽|현탁|로션|스프레이|점비|패치|좌약|츄어블|서방|이알)$/g, "")
      .trim();
    const normBase = normalize(baseName);

    if (normBase.length >= 2) {
      const byBase = items.find((x) => x.itemName && normalize(x.itemName).includes(normBase));
      if (byBase) return byBase;
    }
  }

  // 3순위: slug에서 숫자/규격/제형 제거 후 매칭
  const cleanSlug = slug
    .replace(/\d+[가-힣]*$/, "")
    .replace(/(정|캡슐|액|산|시럽|겔|크림|연고|패치|좌약|스프레이|츄어블|서방정|이알서방정|연질캡슐|과립|엑스과립|나잘스프레이)$/, "")
    .replace(/소아용$|키즈$|어린이$|베이비$|플러스$|프리미엄$/, "")
    .trim();
  const normClean = normalize(cleanSlug);

  if (normClean.length >= 2) {
    const byClean = items.find((x) => x.itemName && normalize(x.itemName).includes(normClean));
    if (byClean) return byClean;
  }

  // 4순위: 첫 2~4글자만으로 매칭 시도 (브랜드명)
  if (slug.length >= 3) {
    const prefix = slug.substring(0, Math.min(4, slug.length));
    const normPrefix = normalize(prefix);
    const candidates = items.filter((x) => x.itemName && normalize(x.itemName).startsWith(normPrefix));
    if (candidates.length === 1) return candidates[0];
    // 여러 개면 가장 이름이 짧은 것 (가장 기본 제품)
    if (candidates.length > 1) {
      candidates.sort((a, b) => a.itemName.length - b.itemName.length);
      return candidates[0];
    }
  }

  return null;
}

// ── 스키마 검증 ─────────────────────────────────────────────────
function validateSchema(sourceData, schema) {
  const errors = [];

  for (const field of schema.requiredFields) {
    if (!sourceData[field] || sourceData[field].trim() === "") {
      errors.push(`필수 필드 누락: ${field}`);
    }
  }

  if (schema.minContentLength) {
    for (const [field, minLen] of Object.entries(schema.minContentLength)) {
      if (sourceData[field] && sourceData[field].length < minLen) {
        errors.push(`${field} 내용 부족 (${sourceData[field].length}자 < ${minLen}자)`);
      }
    }
  }

  return errors;
}

// ── 개별 source JSON 생성 ───────────────────────────────────────
function createSourceJson(slug, cat, edrugItem, fetchedAt) {
  return {
    slug,
    category: cat,
    sourceType: "api",
    sourceOrigin: "e약은요 API (apis.data.go.kr)",
    fetchedAt,
    itemName: edrugItem.itemName || "",
    entpName: edrugItem.entpName || "",
    itemSeq: edrugItem.itemSeq || "",
    efcyQesitm: (edrugItem.efcyQesitm || "").trim(),
    useMethodQesitm: (edrugItem.useMethodQesitm || "").trim(),
    atpnWarnQesitm: (edrugItem.atpnWarnQesitm || "").trim(),
    atpnQesitm: (edrugItem.atpnQesitm || "").trim(),
    intrcQesitm: (edrugItem.intrcQesitm || "").trim(),
    seQesitm: (edrugItem.seQesitm || "").trim(),
    depositMethodQesitm: (edrugItem.depositMethodQesitm || "").trim(),
    itemImage: edrugItem.itemImage || "",
    updateDe: edrugItem.updateDe || "",
  };
}

// ── 메인 ─────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const isStats = args.includes("--stats");
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;

  console.log("=== pharm-jjyu Source Gate: fetch-source.js ===\n");

  // 1. 모든 spoke slug 추출
  console.log("1. Spoke slug 추출 중...");
  const allSlugs = extractAllSpokeSlugs();
  console.log(`   ${allSlugs.length}개 spoke 발견\n`);

  // 2. 제품명 매핑
  console.log("2. 제품 데이터 로드 중...");
  const productMap = buildProductNameMap();
  console.log(`   ${productMap.size}개 제품 매핑\n`);

  // 3. e약은요 데이터 로드
  console.log("3. e약은요 데이터 로드 중...");
  const edrugItems = loadEdrugData();
  console.log(`   ${edrugItems.length}개 의약품 데이터\n`);

  // 4. 스키마 로드
  const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));

  // 5. 매칭 및 source JSON 생성
  console.log("4. 소스 매핑 생성 중...\n");
  const fetchedAt = new Date().toISOString().split("T")[0];
  const sourceMap = {
    _meta: {
      project: "pharm-jjyu",
      totalArticles: allSlugs.length,
      totalMapped: 0,
      totalUnmapped: 0,
      lastFullSync: fetchedAt,
      sourceFreshnessLimit: 90,
    },
  };

  let mapped = 0;
  let unmapped = 0;
  let schemaErrors = 0;
  const unmappedList = [];

  const slugsToProcess = singleSlug
    ? allSlugs.filter((s) => s.slug === singleSlug)
    : allSlugs;

  for (const { cat, slug } of slugsToProcess) {
    const productName = productMap.get(slug);
    const edrugItem = findEdrugItem(edrugItems, slug, productName);

    if (edrugItem) {
      const sourceData = createSourceJson(slug, cat, edrugItem, fetchedAt);

      // 스키마 검증
      const errors = validateSchema(sourceData, schema);
      if (errors.length > 0) {
        schemaErrors++;
        if (!isStats) {
          console.log(`  [WARN] ${cat}/${slug}: 스키마 경고 — ${errors.join(", ")}`);
        }
      }

      // 개별 JSON 저장
      if (!isStats) {
        const outFile = path.join(SOURCE_DIR, `${slug}.json`);
        fs.writeFileSync(outFile, JSON.stringify(sourceData, null, 2), "utf8");
      }

      // source-map 엔트리
      sourceMap[slug] = {
        sourceFile: `${slug}.json`,
        sourceType: "api",
        sourceOrigin: "e약은요 API",
        fetchedAt,
        category: cat,
        canonicalUrl: `/${cat}/${slug}`,
        verified: errors.length === 0,
        itemName: edrugItem.itemName,
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
        reason: "e약은요 API에서 매칭 실패",
      };
      unmapped++;
      unmappedList.push(`${cat}/${slug}` + (productName ? ` (${productName})` : ""));
    }
  }

  sourceMap._meta.totalMapped = mapped;
  sourceMap._meta.totalUnmapped = unmapped;

  // 6. source-map.json 저장
  if (!isStats) {
    fs.writeFileSync(SOURCE_MAP, JSON.stringify(sourceMap, null, 2), "utf8");
  }

  // 7. 결과 출력
  console.log("\n=== 결과 ===");
  console.log(`총 spoke:      ${slugsToProcess.length}개`);
  console.log(`매핑 성공:     ${mapped}개 (${((mapped / slugsToProcess.length) * 100).toFixed(1)}%)`);
  console.log(`매핑 실패:     ${unmapped}개`);
  console.log(`스키마 경고:   ${schemaErrors}개`);

  if (unmappedList.length > 0 && unmappedList.length <= 50) {
    console.log(`\n매핑 실패 목록:`);
    for (const u of unmappedList) {
      console.log(`  - ${u}`);
    }
  } else if (unmappedList.length > 50) {
    console.log(`\n매핑 실패 목록 (처음 50개):`);
    for (const u of unmappedList.slice(0, 50)) {
      console.log(`  - ${u}`);
    }
    console.log(`  ... 외 ${unmappedList.length - 50}개`);
  }

  if (!isStats) {
    console.log(`\nsource-data/ 에 ${mapped}개 JSON 생성 완료`);
    console.log(`source-map.json 생성 완료`);
  }
}

main();
