/**
 * 데이터 파일을 카테고리별로 분리하는 스크립트
 *
 * 실행: node scripts/split-data.js
 *
 * 결과:
 *   data/products/{카테고리}.ts
 *   data/products/index.ts
 *   data/articles/{카테고리}.ts
 *   data/articles/index.ts
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");

// ============================================================
// 1. products 분리
// ============================================================
function splitProducts() {
  console.log("\n=== Products 분리 ===\n");

  // products.ts를 동적으로 파싱하지 않고, 직접 require 가능한 형태로 변환
  const content = fs.readFileSync(path.join(DATA, "products.ts"), "utf-8");

  // 제품 블록 추출 (각 { ... } 객체)
  const productBlocks = [];
  let depth = 0;
  let blockStart = -1;
  let inArray = false;

  for (let i = 0; i < content.length; i++) {
    if (content[i] === "[" && !inArray) {
      inArray = true;
      continue;
    }
    if (!inArray) continue;

    if (content[i] === "{") {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0 && blockStart >= 0) {
        const block = content.substring(blockStart, i + 1);
        // categorySlug 추출
        const catMatch = block.match(/categorySlug:\s*"([^"]+)"/);
        if (catMatch) {
          productBlocks.push({
            category: catMatch[1],
            code: block,
          });
        }
        blockStart = -1;
      }
    }
  }

  // 카테고리별 그룹핑
  const byCategory = {};
  for (const pb of productBlocks) {
    if (!byCategory[pb.category]) byCategory[pb.category] = [];
    byCategory[pb.category].push(pb.code);
  }

  // 8개 카테고리 전부 (비어있는 것도 포함)
  const allCategories = ["연고", "탈모", "감기", "진통제", "무좀", "설사", "소화제", "안약"];

  const outDir = path.join(DATA, "products");

  for (const cat of allCategories) {
    const items = byCategory[cat] || [];
    const fileContent = `import { Product } from "@/lib/types";

export const products: Product[] = [
${items.map(code => "  " + code.replace(/\n/g, "\n  ")).join(",\n")}${items.length > 0 ? "," : ""}
];
`;
    const filePath = path.join(outDir, `${cat}.ts`);
    fs.writeFileSync(filePath, fileContent, "utf-8");
    console.log(`  ✅ products/${cat}.ts (${items.length}개 제품)`);
  }

  // index.ts 생성
  const indexContent = `import { Product } from "@/lib/types";
${allCategories.map(cat => `import { products as ${cat.replace(/[^a-zA-Z가-힣]/g, "")}Products } from "./${cat}";`).join("\n")}

export const products: Product[] = [
${allCategories.map(cat => `  ...${cat.replace(/[^a-zA-Z가-힣]/g, "")}Products,`).join("\n")}
];

export function getProductsByCategory(categorySlug: string): Product[] {
  return products.filter((p) => p.categorySlug === categorySlug);
}

export function getProductBySlug(
  categorySlug: string,
  productSlug: string
): Product | undefined {
  return products.find(
    (p) => p.categorySlug === categorySlug && p.slug === productSlug
  );
}
`;
  fs.writeFileSync(path.join(outDir, "index.ts"), indexContent, "utf-8");
  console.log(`  ✅ products/index.ts (통합)`);
}

// ============================================================
// 2. articles 분리
// ============================================================
function splitArticles() {
  console.log("\n=== Articles 분리 ===\n");

  const content = fs.readFileSync(path.join(DATA, "articles.ts"), "utf-8");

  // hubArticles 파싱: 각 카테고리의 허브 데이터 추출
  // spokeArticles 파싱: 각 카테고리의 스포크 데이터 추출

  // 전략: 정규식 대신 중괄호 카운팅으로 블록 추출

  // hubArticles 영역 찾기
  const hubStart = content.indexOf("export const hubArticles");
  const spokeStart = content.indexOf("export const spokeArticles");

  const hubSection = content.substring(hubStart, spokeStart);
  const spokeSection = content.substring(spokeStart);

  // 허브 카테고리 블록 추출
  function extractCategoryBlocks(section, startMarker) {
    const results = {};
    // 카테고리 키 찾기 (한글 키)
    const keyRegex = /^\s*([\uAC00-\uD7A3a-zA-Z0-9]+):\s*\{/gm;
    let match;
    const keys = [];

    // section 내에서 첫 번째 레벨 키 찾기
    // Record<string, ...> = { 이후의 키들
    const recordStart = section.indexOf("{");
    const innerContent = section.substring(recordStart + 1);

    // 각 카테고리 키와 위치 찾기
    const catKeyRegex = /\n\s{2}([\uAC00-\uD7A3]+):\s*\{/g;
    while ((match = catKeyRegex.exec(innerContent)) !== null) {
      keys.push({ key: match[1], pos: match.index + match[0].length - 1 });
    }

    // 각 키의 블록 추출 (중괄호 카운팅)
    for (let i = 0; i < keys.length; i++) {
      const { key, pos } = keys[i];
      let depth = 1; // 이미 { 안에 있음
      let j = pos + 1;
      while (j < innerContent.length && depth > 0) {
        if (innerContent[j] === "{") depth++;
        else if (innerContent[j] === "}") depth--;
        j++;
      }
      const blockContent = innerContent.substring(pos, j);
      results[key] = blockContent;
    }

    return results;
  }

  const hubBlocks = extractCategoryBlocks(hubSection, "hubArticles");
  const spokeBlocks = extractCategoryBlocks(spokeSection, "spokeArticles");

  const allCategories = ["연고", "탈모", "감기", "진통제", "무좀", "설사", "소화제", "안약"];
  const outDir = path.join(DATA, "articles");

  for (const cat of allCategories) {
    const hubBlock = hubBlocks[cat] || "{\n    categorySlug: \"" + cat + "\",\n    title: \"\",\n    h1: \"\",\n    metaDescription: \"\",\n    description: \"\",\n    heroDescription: \"\",\n    spokes: [],\n  }";
    const spokeBlock = spokeBlocks[cat] || "{}";

    const fileContent = `import { HubArticle, SpokeArticle } from "@/lib/types";

export const hub: HubArticle = ${hubBlock.trimStart()};

export const spokes: Record<string, SpokeArticle> = ${spokeBlock.trimStart()};
`;
    const filePath = path.join(outDir, `${cat}.ts`);
    fs.writeFileSync(filePath, fileContent, "utf-8");

    // spoke 개수 카운팅
    const spokeCount = (spokeBlock.match(/slug:\s*"/g) || []).length;
    console.log(`  ✅ articles/${cat}.ts (허브 + ${spokeCount}개 spoke)`);
  }

  // getSpokeArticle 함수 찾기
  const getSpokeMatch = content.match(/export function getSpokeArticle[\s\S]*?^}/m);

  // index.ts 생성
  const indexContent = `import { HubArticle, SpokeArticle } from "@/lib/types";
${allCategories.map(cat => `import { hub as ${cat}Hub, spokes as ${cat}Spokes } from "./${cat}";`).join("\n")}

export const hubArticles: Record<string, HubArticle> = {
${allCategories.map(cat => `  ${cat}: ${cat}Hub,`).join("\n")}
};

export const spokeArticles: Record<string, Record<string, SpokeArticle>> = {
${allCategories.map(cat => `  ${cat}: ${cat}Spokes,`).join("\n")}
};

export function getSpokeArticle(
  categorySlug: string,
  spokeSlug: string
): SpokeArticle | undefined {
  return spokeArticles[categorySlug]?.[spokeSlug];
}
`;
  fs.writeFileSync(path.join(outDir, "index.ts"), indexContent, "utf-8");
  console.log(`  ✅ articles/index.ts (통합)`);
}

// ============================================================
// 실행
// ============================================================
splitProducts();
splitArticles();

console.log("\n🎉 분리 완료! 원본 파일을 백업하고 삭제하세요:");
console.log("   mv data/products.ts data/products.backup.ts");
console.log("   mv data/articles.ts data/articles.backup.ts");
