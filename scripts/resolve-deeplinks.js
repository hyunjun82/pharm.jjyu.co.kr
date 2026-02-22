/**
 * 발키리 딥링크 자동 수정 스크립트
 * - barkiryProductId가 없는 제품 → 발키리 검색으로 자동 탐색
 * - barkiryProductId가 있지만 404인 제품 → 재검색해서 교체
 * - products.ts 파일을 직접 업데이트
 *
 * 사용법:
 *   npm run fix-deeplinks           # 자동 수정
 *   npm run fix-deeplinks -- --dry-run  # 미리보기 (수정 안 함)
 */

const fs = require("fs");
const path = require("path");

const PRODUCTS_PATH = path.join(__dirname, "..", "data", "products.ts");
const BACKUP_PATH = PRODUCTS_PATH + ".bak";
const BARKIRI_SEARCH = "https://barkiri.com/search";
const BARKIRI_PRODUCT = "https://barkiri.com/products";
const REQUEST_DELAY = 1000; // 1초 딜레이 (rate limit 방지)
const REQUEST_TIMEOUT = 8000; // 8초 타임아웃

const isDryRun = process.argv.includes("--dry-run");

// ─── 유틸리티 ───

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── products.ts 파싱 ───

function loadProductsFile() {
  return fs.readFileSync(PRODUCTS_PATH, "utf-8");
}

/** products.ts에서 모든 제품의 name, barkiryQuery, barkiryProductId 추출 */
function parseProducts(content) {
  const products = [];
  // 각 제품 블록을 { ... } 단위로 분리
  const regex =
    /\{\s*\n(?:[^}]*?)name:\s*"([^"]+)"[^}]*?barkiryQuery:\s*"([^"]+)"(?:[^}]*?barkiryProductId:\s*"([^"]+)")?/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    products.push({
      name: match[1],
      barkiryQuery: match[2],
      barkiryProductId: match[3] || null,
    });
  }
  return products;
}

// ─── 발키리 검색 ───

/** 발키리 검색 결과에서 첫 번째 상품 ID 추출 */
async function searchBarkiri(query) {
  const url = `${BARKIRI_SEARCH}?term=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const html = await res.text();

    // HTML에서 /products/pXXX 패턴 추출
    const matches = html.match(/\/products\/(p\d+)/g);
    if (!matches || matches.length === 0) return null;

    // 중복 제거
    const unique = [...new Set(matches)];
    // 첫 번째 결과의 ID 반환
    const id = unique[0].replace("/products/", "");
    return { id, total: unique.length };
  } catch (err) {
    return null;
  }
}

/** 기존 barkiryProductId가 유효한지 HEAD 요청으로 확인 */
async function checkProductUrl(productId) {
  const url = `${BARKIRI_PRODUCT}/${productId}`;
  try {
    const res = await fetchWithTimeout(url, {
      method: "HEAD",
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── products.ts 업데이트 ───

/** products.ts 파일에서 특정 제품의 barkiryProductId를 추가/변경 */
function updateProductId(content, productName, newId) {
  // 해당 제품 블록 찾기
  const nameEscaped = productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // barkiryProductId가 이미 있는 경우: 교체
  const replaceRegex = new RegExp(
    `(name:\\s*"${nameEscaped}"[^}]*?barkiryQuery:\\s*"[^"]+",)\\n(\\s*barkiryProductId:\\s*"[^"]+",)`
  );

  if (replaceRegex.test(content)) {
    return content.replace(
      replaceRegex,
      `$1\n$2`.replace(
        /barkiryProductId:\s*"[^"]+"/,
        `barkiryProductId: "${newId}"`
      )
    );
  }

  // barkiryProductId가 없는 경우: barkiryQuery 뒤에 추가
  const addRegex = new RegExp(
    `(name:\\s*"${nameEscaped}"[^}]*?barkiryQuery:\\s*"[^"]+",)(\\n)`
  );

  if (addRegex.test(content)) {
    return content.replace(addRegex, `$1\n    barkiryProductId: "${newId}",$2`);
  }

  console.log(`  ⚠️  "${productName}" 블록을 찾을 수 없습니다.`);
  return content;
}

// ─── 메인 ───

async function main() {
  console.log("=== 발키리 딥링크 자동 수정 ===\n");

  if (isDryRun) {
    console.log("🔍 DRY RUN 모드 — 실제 수정 없이 결과만 미리봅니다.\n");
  }

  let content = loadProductsFile();
  const products = parseProducts(content);

  if (products.length === 0) {
    console.log("❌ products.ts에서 제품을 찾을 수 없습니다.");
    process.exit(1);
  }

  console.log(`📦 ${products.length}개 제품 분석 중...\n`);

  let fixed = 0;
  let skipped = 0;
  let notFound = 0;
  const changes = [];

  for (const product of products) {
    const { name, barkiryQuery, barkiryProductId } = product;

    // Case 1: barkiryProductId가 있음 → 유효성 확인
    if (barkiryProductId) {
      const isValid = await checkProductUrl(barkiryProductId);
      if (isValid) {
        console.log(`✅ ${name} → /products/${barkiryProductId} (유효)`);
        skipped++;
      } else {
        console.log(
          `❌ ${name} → /products/${barkiryProductId} (404) — 재검색 중...`
        );
        await sleep(REQUEST_DELAY);

        const result = await searchBarkiri(barkiryQuery);
        if (result) {
          console.log(
            `  🔄 새 ID 발견: ${result.id} (${result.total}개 결과 중 1번째)`
          );
          changes.push({
            name,
            oldId: barkiryProductId,
            newId: result.id,
            action: "교체",
          });
          if (!isDryRun) {
            content = updateProductId(content, name, result.id);
          }
          fixed++;
        } else {
          console.log(
            `  ⚠️  발키리에서 "${barkiryQuery}" 검색 결과 없음 — search fallback 유지`
          );
          notFound++;
        }
      }
    }
    // Case 2: barkiryProductId가 없음 → 검색으로 찾기
    else {
      console.log(`🔍 ${name} → barkiryProductId 없음 — 검색 중...`);
      const result = await searchBarkiri(barkiryQuery);
      if (result) {
        console.log(
          `  ✨ ID 발견: ${result.id} (${result.total}개 결과 중 1번째)`
        );
        changes.push({ name, oldId: null, newId: result.id, action: "추가" });
        if (!isDryRun) {
          content = updateProductId(content, name, result.id);
        }
        fixed++;
      } else {
        console.log(
          `  ⚠️  발키리에서 "${barkiryQuery}" 검색 결과 없음 — search fallback 유지`
        );
        notFound++;
      }
    }

    await sleep(REQUEST_DELAY);
  }

  // 결과 요약
  console.log("\n" + "=".repeat(50));
  console.log("📊 결과 요약");
  console.log("=".repeat(50));
  console.log(`  ✅ 유효 (변경 없음): ${skipped}개`);
  console.log(`  🔄 수정됨: ${fixed}개`);
  console.log(`  ⚠️  발키리에 없음: ${notFound}개`);

  if (changes.length > 0) {
    console.log("\n📝 변경 내역:");
    for (const c of changes) {
      if (c.action === "추가") {
        console.log(`  + ${c.name}: barkiryProductId = "${c.newId}" (신규)`);
      } else {
        console.log(
          `  ~ ${c.name}: "${c.oldId}" → "${c.newId}" (${c.action})`
        );
      }
    }

    if (isDryRun) {
      console.log("\n🔍 DRY RUN — 위 변경을 적용하려면:");
      console.log("   npm run fix-deeplinks");
    } else {
      // 백업 생성
      fs.writeFileSync(BACKUP_PATH, loadProductsFile());
      console.log(`\n💾 백업 생성: ${path.basename(BACKUP_PATH)}`);

      // 파일 저장
      fs.writeFileSync(PRODUCTS_PATH, content, "utf-8");
      console.log(`✅ products.ts 업데이트 완료!`);
      console.log(
        "\n다음 단계: npm run build 로 빌드 + 검증을 실행하세요."
      );
    }
  } else {
    console.log("\n✅ 모든 딥링크가 정상입니다. 수정할 항목이 없습니다.");
  }
}

main();
