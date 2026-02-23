/**
 * 의약품 이미지 전체 파이프라인
 *
 * 1단계: e약은요 API로 이미지 URL 수집
 * 2단계: 다운로드 + AVIF 변환
 * 3단계: products 데이터 자동 매핑
 *
 * 사용법:
 *   node scripts/image-pipeline.mjs --api-key YOUR_KEY
 *   node scripts/image-pipeline.mjs --convert-only   (기존 이미지만 AVIF 변환)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMG_DIR = path.resolve(__dirname, "../public/images");
const PRODUCTS_DIR = path.resolve(__dirname, "../data/products");

const E_DRUG_API =
  "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";

// ========== AVIF 설정 ==========
const AVIF_OPTIONS = {
  quality: 50,       // 50이면 JPEG 80~85 수준 화질, 용량 80~90% 감소
  effort: 4,         // 인코딩 속도 (0=빠름 9=느림, 4가 균형)
  chromaSubsampling: "4:2:0",
};

// 카테고리별 제품 slug 목록 (products 파일에서 읽기)
function getProductSlugs() {
  const slugs = new Map(); // slug → category
  const categories = ["연고", "감기", "진통제", "무좀", "탈모", "설사", "소화제", "안약"];

  for (const cat of categories) {
    const filePath = path.join(PRODUCTS_DIR, `${cat}.ts`);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    // slug: "XXX" 패턴으로 추출
    const slugMatches = content.matchAll(/slug:\s*"([^"]+)"/g);
    for (const match of slugMatches) {
      slugs.set(match[1], cat);
    }
  }

  return slugs;
}

// ========== 1단계: API로 이미지 URL 수집 ==========
async function fetchImageUrls(apiKey, productSlugs) {
  const results = new Map(); // slug → { imageUrl, itemSeq, itemName }

  for (const [slug, category] of productSlugs) {
    // 이미 AVIF가 있으면 건너뛰기
    const avifPath = path.join(IMG_DIR, `${slug}.avif`);
    if (fs.existsSync(avifPath)) {
      console.log(`  ⏭️  ${slug} — AVIF 이미 존재`);
      continue;
    }

    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: "1",
      numOfRows: "5",
      type: "json",
      itemName: slug,
    });

    try {
      const url = `${E_DRUG_API}?${params}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`  ❌ ${slug}: API ${res.status}`);
        continue;
      }

      const data = await res.json();
      const items = data?.body?.items;
      if (!items) {
        console.log(`  ⚠️  ${slug}: 검색 결과 없음`);
        continue;
      }

      const itemList = Array.isArray(items) ? items : [items];
      // 이름이 가장 비슷한 항목 선택
      const bestMatch = itemList.find((item) =>
        item.itemName?.includes(slug)
      ) || itemList[0];

      if (bestMatch?.itemImage) {
        results.set(slug, {
          imageUrl: bestMatch.itemImage,
          itemSeq: bestMatch.itemSeq,
          itemName: bestMatch.itemName,
        });
        console.log(`  ✅ ${slug} → ${bestMatch.itemName} (이미지 있음)`);
      } else {
        console.log(`  ⚠️  ${slug} → ${bestMatch?.itemName || "?"} (이미지 없음)`);
      }
    } catch (err) {
      console.log(`  ❌ ${slug}: ${err.message}`);
    }

    // API 부하 방지
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}

// ========== 2단계: 다운로드 + AVIF 변환 ==========
async function downloadAndConvert(slug, imageUrl) {
  const avifPath = path.join(IMG_DIR, `${slug}.avif`);

  try {
    // 다운로드
    const res = await fetch(imageUrl);
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

    const buffer = Buffer.from(await res.arrayBuffer());
    const originalSize = buffer.length;

    // AVIF 변환
    const avifBuffer = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .avif(AVIF_OPTIONS)
      .toBuffer();

    fs.writeFileSync(avifPath, avifBuffer);

    const ratio = ((1 - avifBuffer.length / originalSize) * 100).toFixed(0);
    return {
      success: true,
      originalSize,
      avifSize: avifBuffer.length,
      ratio: `${ratio}%`,
      path: avifPath,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ========== 기존 이미지 AVIF 변환 ==========
async function convertExistingImages() {
  const files = fs.readdirSync(IMG_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".jpg", ".jpeg", ".png"].includes(ext);
  });

  console.log(`\n📸 기존 이미지 ${files.length}개 AVIF 변환\n`);

  let converted = 0;
  let skipped = 0;
  let totalOriginal = 0;
  let totalAvif = 0;

  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    const avifPath = path.join(IMG_DIR, `${basename}.avif`);
    const srcPath = path.join(IMG_DIR, file);

    if (fs.existsSync(avifPath)) {
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(srcPath);
      const originalSize = buffer.length;

      const avifBuffer = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .avif(AVIF_OPTIONS)
        .toBuffer();

      fs.writeFileSync(avifPath, avifBuffer);

      totalOriginal += originalSize;
      totalAvif += avifBuffer.length;
      converted++;

      const ratio = ((1 - avifBuffer.length / originalSize) * 100).toFixed(0);
      console.log(
        `  ✅ ${file} → ${basename}.avif (${(originalSize / 1024).toFixed(0)}KB → ${(avifBuffer.length / 1024).toFixed(0)}KB, -${ratio}%)`
      );
    } catch (err) {
      console.log(`  ❌ ${file}: ${err.message}`);
    }
  }

  console.log(`\n변환: ${converted}개, 건너뜀: ${skipped}개`);
  if (totalOriginal > 0) {
    const totalRatio = ((1 - totalAvif / totalOriginal) * 100).toFixed(0);
    console.log(
      `총 용량: ${(totalOriginal / 1024).toFixed(0)}KB → ${(totalAvif / 1024).toFixed(0)}KB (-${totalRatio}%)`
    );
  }

  return converted;
}

// ========== 3단계: products 데이터 자동 매핑 ==========
function updateProductImages() {
  const categories = ["연고", "감기", "진통제", "무좀", "탈모", "설사", "소화제", "안약"];
  let updatedCount = 0;

  for (const cat of categories) {
    const filePath = path.join(PRODUCTS_DIR, `${cat}.ts`);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf-8");
    let modified = false;

    // 각 제품의 slug와 image를 찾아서 AVIF가 있으면 교체
    const productBlocks = content.matchAll(
      /slug:\s*"([^"]+)"[\s\S]*?image:\s*"([^"]+)"/g
    );

    // 역순으로 처리하기 위해 모든 image 패턴을 찾기
    const imagePatterns = [...content.matchAll(/image:\s*"([^"]+)"/g)];
    const slugPatterns = [...content.matchAll(/slug:\s*"([^"]+)"/g)];

    // slug-image 매핑 구축 (각 제품 블록 기준)
    for (let i = 0; i < slugPatterns.length; i++) {
      const slug = slugPatterns[i][1];
      const currentImage = imagePatterns[i]?.[1];
      if (!currentImage) continue;

      // slug.avif가 있는지 확인
      const avifPath = path.join(IMG_DIR, `${slug}.avif`);
      // nedrug-slug.avif도 확인
      const nedrugAvifPath = path.join(IMG_DIR, `nedrug-${slug}.avif`);

      let newImage = null;
      if (fs.existsSync(avifPath)) {
        newImage = `/images/${slug}.avif`;
      } else if (fs.existsSync(nedrugAvifPath)) {
        newImage = `/images/nedrug-${slug}.avif`;
      }

      if (newImage && currentImage !== newImage) {
        content = content.replace(
          `image: "${currentImage}"`,
          `image: "${newImage}"`
        );
        modified = true;
        updatedCount++;
        console.log(`  📝 ${cat}/${slug}: ${currentImage} → ${newImage}`);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }

  return updatedCount;
}

// ========== 메인 ==========
async function main() {
  const args = process.argv.slice(2);
  const apiKeyIdx = args.indexOf("--api-key");
  const apiKey = apiKeyIdx !== -1 ? args[apiKeyIdx + 1] : null;
  const convertOnly = args.includes("--convert-only");
  const mapOnly = args.includes("--map-only");

  console.log("╔══════════════════════════════════════╗");
  console.log("║   의약품 이미지 파이프라인            ║");
  console.log("╚══════════════════════════════════════╝\n");

  if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
  }

  // --map-only: 이미 변환된 AVIF를 products에 매핑만
  if (mapOnly) {
    console.log("📝 3단계: products 데이터 매핑\n");
    const updated = updateProductImages();
    console.log(`\n✅ ${updated}개 제품 이미지 경로 업데이트`);
    return;
  }

  // --convert-only: 기존 jpg/png → AVIF 변환만
  if (convertOnly) {
    await convertExistingImages();
    console.log("\n📝 3단계: products 데이터 매핑\n");
    const updated = updateProductImages();
    console.log(`\n✅ ${updated}개 제품 이미지 경로 업데이트`);
    return;
  }

  // 전체 파이프라인 (API 키 필요)
  if (!apiKey) {
    console.log("사용법:");
    console.log("  node scripts/image-pipeline.mjs --api-key YOUR_KEY");
    console.log("  node scripts/image-pipeline.mjs --convert-only");
    console.log("  node scripts/image-pipeline.mjs --map-only");
    console.log("\nAPI 키 발급: https://www.data.go.kr/data/15075057/openapi.do");
    process.exit(1);
  }

  // 1단계: 제품 slug 수집
  const productSlugs = getProductSlugs();
  console.log(`📋 1단계: ${productSlugs.size}개 제품 이미지 URL 수집\n`);

  const imageUrls = await fetchImageUrls(apiKey, productSlugs);
  console.log(`\n→ ${imageUrls.size}개 이미지 URL 확보\n`);

  // 2단계: 다운로드 + AVIF 변환
  console.log(`📥 2단계: 다운로드 + AVIF 변환\n`);

  let successCount = 0;
  let totalOriginal = 0;
  let totalAvif = 0;

  for (const [slug, info] of imageUrls) {
    process.stdout.write(`  ${slug}... `);
    const result = await downloadAndConvert(slug, info.imageUrl);

    if (result.success) {
      successCount++;
      totalOriginal += result.originalSize;
      totalAvif += result.avifSize;
      console.log(
        `✅ ${(result.originalSize / 1024).toFixed(0)}KB → ${(result.avifSize / 1024).toFixed(0)}KB (-${result.ratio})`
      );
    } else {
      console.log(`❌ ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n→ ${successCount}개 변환 완료`);
  if (totalOriginal > 0) {
    const totalRatio = ((1 - totalAvif / totalOriginal) * 100).toFixed(0);
    console.log(
      `   총: ${(totalOriginal / 1024).toFixed(0)}KB → ${(totalAvif / 1024).toFixed(0)}KB (-${totalRatio}%)\n`
    );
  }

  // 기존 이미지도 변환
  await convertExistingImages();

  // 3단계: products 매핑
  console.log("\n📝 3단계: products 데이터 매핑\n");
  const updated = updateProductImages();
  console.log(`\n✅ ${updated}개 제품 이미지 경로 업데이트`);

  console.log("\n🎉 파이프라인 완료! npm run build로 검증하세요.");
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
