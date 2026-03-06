/**
 * 발키리 딥링크 검증 스크립트
 * data/products/{카테고리}.ts 에서 자동으로 제품 목록을 읽어 검증합니다.
 *
 * 사용법: node scripts/verify-deeplinks.js
 */

const fs = require("fs");
const path = require("path");

/** data/products/ 폴더의 모든 카테고리 파일에서 barkiryProductId가 있는 제품 목록 추출 */
function loadProducts() {
  const productsDir = path.join(__dirname, "..", "data", "products");
  const files = fs.readdirSync(productsDir).filter(f => f.endsWith(".ts") && f !== "index.ts");

  const products = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(productsDir, file), "utf-8");
    const blocks = content.split(/\{[^}]*?name:/);

    for (const block of blocks) {
      const nameMatch = block.match(/^\s*"([^"]+)"/);
      const idMatch = block.match(/barkiryProductId:\s*"([^"]+)"/);
      if (nameMatch && idMatch) {
        products.push({ name: nameMatch[1], id: idMatch[1] });
      }
    }
  }

  return products;
}

async function checkDeeplink(name, productId) {
  const url = `https://barkiri.com/products/${productId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { name, url, status: "OK", code: res.status };
    } else {
      return { name, url, status: "FAIL", code: res.status };
    }
  } catch (err) {
    clearTimeout(timeout);
    return { name, url, status: "ERROR", code: err.message };
  }
}

async function main() {
  // Vercel 빌드 서버에서는 발키리가 클라우드 IP를 403 차단하므로 스킵
  if (process.env.VERCEL) {
    console.log("=== 발키리 딥링크 검증 (Vercel 환경 — 스킵) ===");
    console.log("ℹ️  Vercel 빌드 서버 IP가 barkiri.com에서 차단되어 로컬에서만 검증합니다.");
    process.exit(0);
  }

  console.log("=== 발키리 딥링크 검증 ===\n");

  const products = loadProducts();

  if (products.length === 0) {
    console.log("⚠️  products.ts에서 barkiryProductId를 찾을 수 없습니다.");
    process.exit(1);
  }

  console.log(`📦 ${products.length}개 제품 검증 중...\n`);

  let passed = 0;
  let failed = 0;

  for (const { name, id } of products) {
    const result = await checkDeeplink(name, id);
    const icon = result.status === "OK" ? "✅" : "❌";
    console.log(`${icon} ${result.name} → ${result.url} [${result.code}]`);
    if (result.status === "OK") passed++;
    else failed++;
  }

  console.log(
    `\n--- 결과: ${passed}/${products.length} 통과, ${failed} 실패 ---`
  );

  if (failed > 0) {
    console.log(
      "\n⚠️  실패한 딥링크가 있습니다. 'npm run fix-deeplinks'로 자동 수정하세요."
    );
    process.exit(1);
  }
}

main();
