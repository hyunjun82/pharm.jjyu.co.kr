/**
 * 존재하지 않는 .svg 이미지 경로를 placeholder.svg로 수정
 */
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.resolve(__dirname, '../data/products');
const IMAGES_DIR = path.resolve(__dirname, '../public/images');

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');

let totalFixed = 0;

for (const f of files) {
  const filePath = path.join(PRODUCTS_DIR, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // image: "/images/xxx.svg" 패턴 찾기 (placeholder.svg, barkiri- 제외)
  const svgPattern = /image:\s*"(\/images\/(?!placeholder|barkiri)[^"]+\.svg)"/g;
  let match;
  const fixes = [];

  while ((match = svgPattern.exec(content)) !== null) {
    const imgPath = match[1];
    const fileName = path.basename(imgPath); // e.g., "fucidin-5g.svg"
    const fullPath = path.join(IMAGES_DIR, fileName);

    if (!fs.existsSync(fullPath)) {
      fixes.push({ original: match[0], imgPath });
    }
  }

  for (const fix of fixes) {
    content = content.replace(fix.original, 'image: "/images/placeholder.svg"');
    console.log(`  [${f.replace('.ts','')}] ${fix.imgPath} → placeholder.svg`);
    totalFixed++;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
}

console.log(`\n총 ${totalFixed}개 경로 수정 완료`);
