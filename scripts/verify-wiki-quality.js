/**
 * 약품 위키 글 품질 검증 스크립트
 * 사용법: node scripts/verify-wiki-quality.js
 */

const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.resolve(__dirname, "../data/articles");
const PRODUCTS_DIR = path.resolve(__dirname, "../data/products");
const CATEGORIES = ["연고", "감기", "진통제", "무좀", "탈모", "설사", "소화제", "안약"];
const EXTERNAL_CATEGORIES = ["연고", "무좀", "안약"];
const EXTERNAL_TALMO = ["미녹시딜", "판시딜", "두피나액", "판시딜액", "로게인", "카필러스폼", "미녹시폼", "판시딜액3", "동성미녹시딜3", "나녹시딜액", "마이딜액", "목시딜액", "백일후애액", "볼두민액", "마이녹실액", "미녹시딜바이그루트액3"];

let totalErrors = 0;
let totalWarnings = 0;
const errorList = [];
const warnList = [];

function err(cat, slug, msg) {
  errorList.push({ cat, slug, msg });
  totalErrors++;
}
function wrn(cat, slug, msg) {
  // 경고도 에러로 처리 — 전부 수정 대상
  errorList.push({ cat, slug, msg });
  totalErrors++;
}

// 제품 딥링크 맵
function getProductMap() {
  const map = new Map();
  for (const cat of CATEGORIES) {
    const fp = path.join(PRODUCTS_DIR, `${cat}.ts`);
    if (!fs.existsSync(fp)) continue;
    const c = fs.readFileSync(fp, "utf-8");
    const slugs = [...c.matchAll(/slug:\s*"([^"]+)"/g)];
    for (const m of slugs) {
      const slug = m[1];
      const idx = m.index;
      // 해당 slug 앞의 블록에서 barkiryProductId/externalSearchUrl 확인
      const blockStart = c.lastIndexOf("{", idx);
      const block = c.substring(blockStart, idx + 200);
      const hasDeeplink = /barkiryProductId:|externalSearchUrl:/.test(block);
      map.set(slug, { hasDeeplink, category: cat });
    }
  }
  return map;
}

// spoke 블록 분리 (spokes 객체 안에서 최상위 키별 분리)
function splitSpokeBlocks(content) {
  // "export const spokes" 이후 부분
  const spokesStart = content.indexOf("export const spokes");
  if (spokesStart === -1) return [];

  const afterExport = content.substring(spokesStart);
  // 첫 { 찾기
  const firstBrace = afterExport.indexOf("{");
  const spokesBody = afterExport.substring(firstBrace + 1);

  // 최상위 키 찾기: 줄 시작에서 4칸 들여쓰기 + 한글키: {
  const keyPattern = /^[ ]{2,6}([\w가-힣]+)\s*:\s*\{/gm;
  const keys = [...spokesBody.matchAll(keyPattern)];

  const blocks = [];
  for (let i = 0; i < keys.length; i++) {
    const slug = keys[i][1];
    const start = keys[i].index;
    const end = i < keys.length - 1 ? keys[i + 1].index : spokesBody.length;
    blocks.push({ slug, raw: spokesBody.substring(start, end) });
  }
  return blocks;
}

function isExternalUse(cat, slug) {
  if (EXTERNAL_CATEGORIES.includes(cat)) return true;
  if (cat === "탈모" && EXTERNAL_TALMO.includes(slug)) return true;
  if (slug.includes("나잘") || slug.includes("스프레이")) return true;
  return false;
}

function verifyArticle(cat, block) {
  const { slug, raw } = block;

  // === title, h1 ===
  const titleM = raw.match(/title:\s*"([^"]+)"/);
  const h1M = raw.match(/h1:\s*"([^"]+)"/);
  const title = titleM ? titleM[1] : "";
  const h1 = h1M ? h1M[1] : "";

  if (!title) err(cat, slug, "title 없음");
  if (!h1) err(cat, slug, "h1 없음");
  if (title && h1 && title !== h1) err(cat, slug, `title ≠ h1`);

  // === faq 개수 ===
  const faqCount = (raw.match(/question:\s*"/g) || []).length;
  if (faqCount !== 3) err(cat, slug, `FAQ ${faqCount}개 (3개 필요)`);

  // === sections 개수 ===
  // sections 블록 안의 title만 추출
  const sectionsStart = raw.indexOf("sections:");
  if (sectionsStart === -1) {
    err(cat, slug, "sections 없음");
    return;
  }
  const sectionsRaw = raw.substring(sectionsStart);
  const secTitles = [...sectionsRaw.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (secTitles.length !== 6) err(cat, slug, `섹션 ${secTitles.length}개 (6개 필요)`);

  // === ingredients 존재 ===
  const hasIngredients = /ingredients:\s*\[/.test(raw);
  if (!hasIngredients) err(cat, slug, "ingredients 배열 없음");

  // === 주성분 amount + 첨가제 ===
  if (hasIngredients) {
    const ingBlock = raw.match(/ingredients:\s*\[([\s\S]*?)\]\s*,/);
    if (ingBlock) {
      const ib = ingBlock[1];
      const types = [...ib.matchAll(/type:\s*"([^"]+)"/g)].map((m) => m[1]);
      const hasAdditive = types.includes("첨가제");
      if (!hasAdditive) wrn(cat, slug, "첨가제 없음");

      // 주성분 amount 확인
      const ingItems = ib.split(/\}\s*,/).filter((s) => s.includes('type:'));
      for (const item of ingItems) {
        const typeM = item.match(/type:\s*"([^"]+)"/);
        const nameM = item.match(/name:\s*"([^"]+)"/);
        const amtM = item.match(/amount:\s*"/);
        if (typeM && typeM[1] === "주성분" && !amtM) {
          wrn(cat, slug, `주성분 amount 누락: ${nameM ? nameM[1] : "?"}`);
        }
      }
    }
  }

  // === 문체 (content 내 문어체) ===
  const contents = [...sectionsRaw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)];
  for (const cm of contents) {
    const text = cm[1];
    // 합니다/입니다 등 문어체
    if (/(?<!메타|설명)[^\\"]*(합니다|입니다|됩니다|었습니다|있습니다|없습니다)/.test(text)) {
      const match = text.match(/(합니다|입니다|됩니다|었습니다|있습니다|없습니다)/);
      err(cat, slug, `content 내 문어체: "...${match[0]}"`);
    }
  }

  // faq answer 문어체
  const faqAnswers = [...raw.matchAll(/answer:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)];
  for (const fa of faqAnswers) {
    if (/(합니다|입니다|됩니다)/.test(fa[1])) {
      err(cat, slug, "FAQ 답변 내 문어체");
    }
  }

  // === Em dash ===
  if (raw.includes("—")) err(cat, slug, "Em dash (—) 발견");

  // === 문단 수 (섹션당 3문단) ===
  for (let i = 0; i < contents.length && i < secTitles.length; i++) {
    const paragraphs = contents[i][1].split("\\n\\n").length;
    if (paragraphs < 3) {
      if (paragraphs < 2) {
        err(cat, slug, `"${secTitles[i]}" ${paragraphs}문단 (최소 3)`);
      } else {
        wrn(cat, slug, `"${secTitles[i]}" ${paragraphs}문단 (최소 3)`);
      }
    }
  }

  // === 타이틀 공식 ===
  const expectedUsage = isExternalUse(cat, slug) ? "사용법" : "복용법";
  if (title && !title.includes(expectedUsage)) {
    wrn(cat, slug, `타이틀에 "${expectedUsage}" 없음`);
  }

  // === 섹션 제목 일치 ===
  const expected = [
    `${slug} 성분 분석`,
    `${slug} 효능과 효과`,
    `${slug} 올바른 ${expectedUsage}`,
    `${slug} 부작용`,
    `${slug} 주의사항`,
    `${slug} 보관법`,
  ];
  for (let i = 0; i < Math.min(secTitles.length, 6); i++) {
    if (secTitles[i] !== expected[i]) {
      const n1 = secTitles[i].replace(/\s+/g, "");
      const n2 = expected[i].replace(/\s+/g, "");
      if (n1 === n2) {
        wrn(cat, slug, `섹션 제목 띄어쓰기: "${secTitles[i]}" → "${expected[i]}"`);
      } else {
        err(cat, slug, `섹션 제목 불일치: "${secTitles[i]}" (기대: "${expected[i]}")`);
      }
    }
  }

  return title;
}

// ========== 메인 ==========
function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   약품 위키 글 품질 검증              ║");
  console.log("╚══════════════════════════════════════╝\n");

  const productMap = getProductMap();
  let totalArticles = 0;

  for (const cat of CATEGORIES) {
    const fp = path.join(ARTICLES_DIR, `${cat}.ts`);
    if (!fs.existsSync(fp)) {
      console.log(`⚠️  ${cat}.ts 없음`);
      continue;
    }
    const content = fs.readFileSync(fp, "utf-8");
    const blocks = splitSpokeBlocks(content);
    console.log(`📂 ${cat} — ${blocks.length}개 spoke`);
    totalArticles += blocks.length;

    for (const block of blocks) {
      const title = verifyArticle(cat, block);

      // 최저가 가격 vs 딥링크
      if (title && title.includes("최저가 가격")) {
        const product = productMap.get(block.slug);
        if (!product) {
          err(cat, block.slug, "products 데이터 없는데 '최저가 가격' 타이틀");
        } else if (!product.hasDeeplink) {
          err(cat, block.slug, "딥링크 없는데 '최저가 가격' 타이틀");
        }
      }
    }
  }

  // === 결과 출력 ===
  if (errorList.length > 0) {
    console.log(`\n❌ 에러 ${errorList.length}건:\n`);
    for (const e of errorList) {
      console.log(`  ❌ [${e.cat}/${e.slug}] ${e.msg}`);
    }
  }

  if (warnList.length > 0) {
    console.log(`\n⚠️  경고 ${warnList.length}건:\n`);
    for (const w of warnList) {
      console.log(`  ⚠️  [${w.cat}/${w.slug}] ${w.msg}`);
    }
  }

  console.log("\n══════════════════════════════════════");
  console.log(`📊 총 ${totalArticles}개 글 검증 완료`);
  console.log(`   ❌ 에러: ${totalErrors}건`);
  console.log(`   ⚠️  경고: ${totalWarnings}건`);

  if (totalErrors === 0) {
    console.log("\n✅ 필수 품질 기준 통과!");
  } else {
    console.log("\n❌ 에러 수정 필요!");
  }

  if (totalErrors > 0) process.exit(1);
}

main();
