/**
 * build-facts-whitelist.js
 *
 * source-data/{slug}.json을 분석해 writer가 인용 가능한 facts whitelist 생성.
 *
 * 사용법:
 *   node scripts/build-facts-whitelist.js {slug}
 *
 * 출력:
 *   _workspace/{slug}-facts.json
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const WORKSPACE_DIR = path.resolve(__dirname, "..", "_workspace");
const PRODUCTS_DIR = path.resolve(__dirname, "..", "data", "products");

function ensureWorkspace() {
  if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

function extractNumericValues(text) {
  if (!text) return [];
  const set = new Set();
  const patterns = [
    /\d+(?:\.\d+)?\s*(?:mg|밀리그램|g|그램|%|mL|ml|밀리리터|배|일|주|개월|년|회|정|캡슐|포|세|개)/g,
    /\b\d+(?:\.\d+)?\b/g,
  ];
  for (const p of patterns) {
    const matches = text.match(p) || [];
    matches.forEach((m) => set.add(m.trim()));
  }
  return Array.from(set);
}

function findProduct(slug) {
  const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  for (const f of files) {
    const content = fs.readFileSync(path.join(PRODUCTS_DIR, f), "utf8");
    const idx = content.indexOf(`slug: "${slug}"`);
    if (idx === -1) continue;
    const start = content.lastIndexOf("{", idx);
    const end = content.indexOf("}", idx);
    if (start === -1 || end === -1) continue;
    const block = content.substring(start, end + 1);
    const m = (re) => (block.match(re) || [])[1];
    return {
      name: m(/name:\s*"([^"]+)"/),
      price: parseInt(m(/price:\s*(\d+)/) || "0", 10),
      unit: m(/unit:\s*"([^"]+)"/),
      barkiryQuery: m(/barkiryQuery:\s*"([^"]+)"/),
      barkiryProductId: m(/barkiryProductId:\s*"([^"]+)"/),
      externalSearchUrl: m(/externalSearchUrl:\s*"([^"]+)"/),
    };
  }
  return null;
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node build-facts-whitelist.js {slug}");
    process.exit(1);
  }

  ensureWorkspace();

  const sourceFile = path.join(SOURCE_DIR, `${slug}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.error(`ABORT: source-data/${slug}.json 없음`);
    process.exit(1);
  }

  const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  const product = findProduct(slug);

  // 정량 데이터 추출
  const numericValues = new Set();
  ["efcyQesitm", "useMethodQesitm", "atpnWarnQesitm", "atpnQesitm", "intrcQesitm", "seQesitm", "depositMethodQesitm"].forEach((field) => {
    extractNumericValues(source[field]).forEach((n) => numericValues.add(n));
  });

  const facts = {
    slug,
    category: source.category,
    itemName: source.itemName,
    entpName: source.entpName,
    itemSeq: source.itemSeq,
    sourceOrigin: source.sourceOrigin,
    fetchedAt: source.fetchedAt,

    // 원문 텍스트 (writer가 인용)
    efcyQesitm: source.efcyQesitm,
    useMethodQesitm: source.useMethodQesitm,
    atpnWarnQesitm: source.atpnWarnQesitm,
    atpnQesitm: source.atpnQesitm,
    intrcQesitm: source.intrcQesitm,
    seQesitm: source.seQesitm,
    depositMethodQesitm: source.depositMethodQesitm,
    itemImage: source.itemImage,

    // 추출된 정량 데이터 화이트리스트 (writer는 이 set 안에서만 숫자 사용)
    numericValues: Array.from(numericValues).sort(),

    // 가격 데이터 (data/products에서)
    priceData: product
      ? {
          min: product.price,
          max: Math.round(product.price * 1.5), // TODO: 실제 약국별 가격 범위 데이터로 교체
          storeCount: 0,
          average: product.price,
          unit: product.unit,
          source: "data/products/{cat}.ts (단일 가격)",
        }
      : null,

    deeplinks: product
      ? {
          barkiryQuery: product.barkiryQuery,
          barkiryProductId: product.barkiryProductId,
          externalSearchUrl: product.externalSearchUrl,
        }
      : null,
  };

  const outFile = path.join(WORKSPACE_DIR, `${slug}-facts.json`);
  fs.writeFileSync(outFile, JSON.stringify(facts, null, 2), "utf8");

  console.log(`facts.json 생성: ${outFile}`);
  console.log(`  numericValues: ${facts.numericValues.length}개`);
  console.log(`  priceData: ${facts.priceData ? "있음" : "없음 (data/products 에서 못 찾음)"}`);
}

main();
