/**
 * 존재하지 않는 이미지 참조를 placeholder.svg로 교체
 * 사용법: node scripts/fix-missing-images.js
 */

const fs = require("fs");
const path = require("path");

const PRODUCTS_DIR = path.resolve(__dirname, "../data/products");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const CATEGORIES = ["연고", "감기", "진통제", "무좀", "탈모", "설사", "소화제", "안약"];

let fixedCount = 0;
let okCount = 0;

for (const cat of CATEGORIES) {
  const fp = path.join(PRODUCTS_DIR, `${cat}.ts`);
  if (!fs.existsSync(fp)) {
    console.log(`⚠️  ${cat}.ts 없음`);
    continue;
  }

  let content = fs.readFileSync(fp, "utf-8");
  let modified = false;

  // image: "/images/xxx.yyy" 패턴 찾기
  const imagePattern = /image:\s*"([^"]+)"/g;
  const matches = [...content.matchAll(imagePattern)];

  for (const match of matches) {
    const imagePath = match[1]; // e.g., "/images/lamisil.svg"
    const fullPath = path.join(PUBLIC_DIR, imagePath);

    if (fs.existsSync(fullPath)) {
      okCount++;
    } else {
      console.log(`  ❌ [${cat}] ${imagePath} → /images/placeholder.svg`);
      content = content.replace(`image: "${imagePath}"`, `image: "/images/placeholder.svg"`);
      modified = true;
      fixedCount++;
    }
  }

  if (modified) {
    fs.writeFileSync(fp, content, "utf-8");
  }
}

console.log(`\n✅ 정상: ${okCount}개, 수정: ${fixedCount}개`);

if (fixedCount > 0) {
  console.log(`\n📝 ${fixedCount}개 제품 이미지 경로를 placeholder.svg로 변경했어요.`);
}
