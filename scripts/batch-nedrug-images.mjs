/**
 * 전체 제품 이미지 일괄 다운로드 + 자동 업데이트
 *
 * 전략:
 *  1순위: barkiryProductId가 있으면 barkiri CDN에서 webp 다운로드
 *         https://barkiri.edge.naverncp.com/product/{id}.webp
 *  2순위: nedrug.mfds.go.kr 검색으로 itemSeq 획득 후 이미지 다운로드
 *
 * 사용법:
 *   node scripts/batch-nedrug-images.mjs           ← 전체 처리
 *   node scripts/batch-nedrug-images.mjs --category=연고   ← 카테고리 한정
 *   node scripts/batch-nedrug-images.mjs --dry-run  ← 실제 저장 안 함
 *   node scripts/batch-nedrug-images.mjs --barkiri-only  ← barkiri만
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = path.resolve(__dirname, "../data/products");
const IMG_DIR = path.resolve(__dirname, "../public/images");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BARKIRI_ONLY = args.includes("--barkiri-only");
const CATEGORY_FILTER = args
  .find((a) => a.startsWith("--category="))
  ?.replace("--category=", "");
const DELAY_MS = 300;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
};

// ─── 파싱 ─────────────────────────────────────────────────

/**
 * 제품 파일에서 placeholder.svg 사용 제품 목록 추출
 * 각 제품 블록에서 { id, name, slug, barkiryProductId? } 반환
 */
function extractPlaceholderProducts(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const products = [];
  const lines = content.split("\n");

  let depth = 0;
  let blockLines = [];

  for (const line of lines) {
    const prevDepth = depth;
    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }

    // 제품 블록 시작 (depth 0→1)
    if (prevDepth === 0 && depth === 1) {
      blockLines = [line];
    } else if (depth >= 1) {
      blockLines.push(line);
    }

    // 제품 블록 종료 (depth 1→0)
    if (prevDepth === 1 && depth === 0) {
      const block = blockLines.join("\n");

      if (block.includes('"/images/placeholder.svg"')) {
        const getId = block.match(/\bid:\s*"([^"]+)"/)?.[1] || "";
        const getName = block.match(/\bname:\s*"([^"]+)"/)?.[1] || "";
        const getSlug = block.match(/\bslug:\s*"([^"]+)"/)?.[1] || "";
        const getBarkiryId =
          block.match(/barkiryProductId:\s*"([^"]+)"/)?.[1] || "";

        if (getSlug) {
          products.push({
            id: getId,
            name: getName,
            slug: getSlug,
            barkiryProductId: getBarkiryId,
          });
        }
      }
      blockLines = [];
    }
  }

  return products;
}

// ─── 이미지 소스 1: Barkiri CDN ──────────────────────────

async function downloadFromBarkiri(barkiryProductId, slug) {
  const url = `https://barkiri.edge.naverncp.com/product/${barkiryProductId}.webp`;
  try {
    const res = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: `https://barkiri.com/products/${barkiryProductId}`,
      },
    });

    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image") && !contentType.includes("webp")) {
      return { success: false, error: `이미지 아님: ${contentType}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500)
      return { success: false, error: "파일 너무 작음" };

    const filename = `barkiri-${slug}.webp`;
    const filepath = path.join(IMG_DIR, filename);
    if (!DRY_RUN) fs.writeFileSync(filepath, buffer);

    return {
      success: true,
      filename,
      path: `/images/${filename}`,
      size: buffer.length,
      source: "barkiri",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── 이미지 소스 2: nedrug ───────────────────────────────

async function searchNedrug(searchTerm) {
  const url = `https://nedrug.mfds.go.kr/search?query=${encodeURIComponent(searchTerm)}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/getItemDetail\?itemSeq=(\d{8,13})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function downloadFromNedrug(itemSeq, slug) {
  // 방법 1: 직접 다운로드 엔드포인트
  const directUrl = `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${itemSeq}`;
  try {
    const res = await fetch(directUrl, {
      headers: {
        ...HEADERS,
        Referer: `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${itemSeq}`,
      },
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("image")) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 1000) {
          const ext = contentType.includes("png") ? ".png" : ".jpg";
          const filename = `nedrug-${slug}${ext}`;
          if (!DRY_RUN)
            fs.writeFileSync(path.join(IMG_DIR, filename), buffer);
          return {
            success: true,
            filename,
            path: `/images/${filename}`,
            size: buffer.length,
            source: "nedrug-direct",
          };
        }
      }
    }
  } catch {}

  // 방법 2: 상세 페이지에서 이미지 URL 파싱
  try {
    const detailUrl = `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${itemSeq}`;
    const res = await fetch(detailUrl, { headers: HEADERS });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const html = await res.text();

    const urlMatch = html.match(
      /https?:\/\/nedrug\.mfds\.go\.kr\/pbp\/cmn\/itemImageDownload\/\d+/
    );
    if (urlMatch) {
      const imgRes = await fetch(urlMatch[0], { headers: HEADERS });
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const ct = imgRes.headers.get("content-type") || "";
        const ext = ct.includes("png") ? ".png" : ".jpg";
        const filename = `nedrug-${slug}${ext}`;
        if (!DRY_RUN) fs.writeFileSync(path.join(IMG_DIR, filename), buffer);
        return {
          success: true,
          filename,
          path: `/images/${filename}`,
          size: buffer.length,
          source: "nedrug-parse",
        };
      }
    }
    return { success: false, error: "이미지 URL 없음" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── 파일 업데이트 ────────────────────────────────────────

/**
 * 제품 파일에서 특정 slug의 image 경로를 업데이트
 * placeholder.svg → 새 이미지 경로
 */
function updateProductImage(filePath, slug, imagePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let updated = false;

  // 패턴 1: image가 slug보다 먼저 나오는 경우 (id→name→image→...→slug 순서)
  // 블록 전체를 찾아서 slug 일치 확인 후 image 교체
  const newContent = content.replace(
    /(\{[^{}]*?)(image:\s*"\/images\/placeholder\.svg")([^{}]*?slug:\s*"[^"]*"[^{}]*?\})/gs,
    (match, before, imageField, after) => {
      if (!after.includes(`"${slug}"`)) return match;
      updated = true;
      return before + `image: "${imagePath}"` + after;
    }
  );

  if (updated) {
    if (!DRY_RUN) fs.writeFileSync(filePath, newContent, "utf-8");
    return true;
  }

  // 패턴 2: slug가 image보다 먼저 나오는 경우
  const newContent2 = content.replace(
    /(\{[^{}]*?slug:\s*"[^"]*"[^{}]*?)(image:\s*"\/images\/placeholder\.svg")([^{}]*?\})/gs,
    (match, before, imageField, after) => {
      if (!before.includes(`"${slug}"`)) return match;
      updated = true;
      return before + `image: "${imagePath}"` + after;
    }
  );

  if (updated) {
    if (!DRY_RUN) fs.writeFileSync(filePath, newContent2, "utf-8");
    return true;
  }

  return false;
}

// ─── 메인 ─────────────────────────────────────────────────

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=========================================");
  console.log("  제품 이미지 일괄 다운로드 + 자동 업데이트");
  console.log("  1순위: Barkiri CDN | 2순위: nedrug");
  if (DRY_RUN) console.log("  [DRY-RUN: 실제 저장 안 함]");
  if (BARKIRI_ONLY) console.log("  [Barkiri 전용 모드]");
  if (CATEGORY_FILTER) console.log(`  [카테고리: ${CATEGORY_FILTER}]`);
  console.log("=========================================\n");

  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  // 1. 처리 대상 파일 목록
  const allFiles = fs
    .readdirSync(PRODUCTS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => ({ file: f, category: f.replace(".ts", "") }));

  const files = CATEGORY_FILTER
    ? allFiles.filter((f) => f.category === CATEGORY_FILTER)
    : allFiles;

  // 2. placeholder 제품 수집
  let tasks = [];
  for (const { file, category } of files) {
    const filepath = path.join(PRODUCTS_DIR, file);
    const products = extractPlaceholderProducts(filepath);
    for (const p of products) {
      tasks.push({ ...p, category, filepath });
    }
  }

  console.log(`총 ${tasks.length}개 제품 처리 예정\n`);

  // 3. 이미 존재하는 이미지는 파일 업데이트만
  let existingCount = 0;
  const pending = [];

  for (const task of tasks) {
    const candidates = [
      `barkiri-${task.slug}.webp`,
      `nedrug-${task.slug}.jpg`,
      `nedrug-${task.slug}.png`,
      `nedrug-${task.slug}.avif`,
      `${task.slug}.avif`,
      `${task.slug}.jpg`,
    ];

    let foundPath = null;
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(IMG_DIR, candidate))) {
        foundPath = `/images/${candidate}`;
        break;
      }
    }

    if (foundPath) {
      const updated = updateProductImage(task.filepath, task.slug, foundPath);
      if (updated) {
        console.log(`  ✅ ${task.slug} — 기존 이미지 활용 (${foundPath})`);
        existingCount++;
      }
    } else {
      pending.push(task);
    }
  }

  if (existingCount > 0) {
    console.log(`\n기존 이미지 활용: ${existingCount}개\n`);
  }

  // barkiri 있는 것 / 없는 것 분류
  const withBarkiri = pending.filter((t) => t.barkiryProductId);
  const withoutBarkiri = pending.filter((t) => !t.barkiryProductId);

  console.log(`Barkiri ID 있음: ${withBarkiri.length}개`);
  console.log(`Barkiri ID 없음 (nedrug 시도): ${withoutBarkiri.length}개`);
  console.log("");

  let successCount = 0;
  let failCount = 0;
  const failures = [];

  // 4. Barkiri CDN에서 다운로드
  for (let i = 0; i < withBarkiri.length; i++) {
    const task = withBarkiri[i];
    const progress = `[${i + 1}/${withBarkiri.length}]`;

    process.stdout.write(
      `  ${progress} 🛒 ${task.slug} (${task.barkiryProductId})... `
    );

    const result = await downloadFromBarkiri(task.barkiryProductId, task.slug);

    if (result.success) {
      const updated = updateProductImage(
        task.filepath,
        task.slug,
        result.path
      );
      const status = updated ? "✅" : "⚠️파일업뎃실패";
      console.log(`${status} ${(result.size / 1024).toFixed(1)}KB`);
      if (updated) successCount++;
      else {
        failCount++;
        failures.push({ ...task, error: "파일 업데이트 실패", result });
      }
    } else {
      console.log(`❌ ${result.error}`);
      failCount++;
      failures.push({ ...task, error: result.error });
    }

    await delay(DELAY_MS);
  }

  // 5. nedrug에서 다운로드 (barkiri ID 없는 것)
  if (!BARKIRI_ONLY && withoutBarkiri.length > 0) {
    console.log(`\n--- nedrug 검색 시작 (${withoutBarkiri.length}개) ---\n`);

    for (let i = 0; i < withoutBarkiri.length; i++) {
      const task = withoutBarkiri[i];
      const progress = `[${i + 1}/${withoutBarkiri.length}]`;

      process.stdout.write(`  ${progress} 🔍 ${task.slug} (nedrug)... `);

      let itemSeq = await searchNedrug(task.slug);
      if (!itemSeq) itemSeq = await searchNedrug(task.name);

      if (!itemSeq) {
        console.log(`❌ 검색 실패`);
        failCount++;
        failures.push({ ...task, error: "nedrug 검색 실패" });
        await delay(DELAY_MS);
        continue;
      }

      const result = await downloadFromNedrug(itemSeq, task.slug);
      if (result.success) {
        const updated = updateProductImage(
          task.filepath,
          task.slug,
          result.path
        );
        const status = updated ? "✅" : "⚠️";
        console.log(`${status} ${(result.size / 1024).toFixed(1)}KB`);
        if (updated) successCount++;
        else failCount++;
      } else {
        console.log(`❌ ${result.error}`);
        failCount++;
        failures.push({ ...task, error: result.error, itemSeq });
      }

      await delay(DELAY_MS);
    }
  }

  // 6. 결과 요약
  console.log("\n=========================================");
  console.log("  결과 요약");
  console.log("=========================================");
  console.log(`  기존 이미지 활용:  ${existingCount}개`);
  console.log(`  신규 다운로드 성공: ${successCount}개`);
  console.log(`  실패:              ${failCount}개`);

  if (failures.length > 0) {
    console.log("\n⚠️ 실패 목록:");
    for (const f of failures) {
      const pid = f.barkiryProductId ? ` [${f.barkiryProductId}]` : "";
      console.log(`  ${f.category}/${f.slug}${pid}: ${f.error}`);
    }

    const failPath = path.resolve(__dirname, "../tmp/image-failures.json");
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(failPath), { recursive: true });
      fs.writeFileSync(failPath, JSON.stringify(failures, null, 2), "utf-8");
      console.log(`\n  실패 목록 저장: tmp/image-failures.json`);
    }
  }

  console.log("\n완료! npm run build 로 검증 후 커밋하세요.\n");
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
