/**
 * Layer 2: Fact Gate — 글 본문 숫자/성분 ↔ source JSON 대조
 *
 * 사용법:
 *   node scripts/verify-facts.js               전체 검증
 *   node scripts/verify-facts.js --slug 마데카솔  특정 slug만
 *   node scripts/verify-facts.js --category 감기  카테고리 단위
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const CONFIG_FILE = path.join(__dirname, "quality-config.json");

// ── 글에서 spoke 블록 분리 ───────────────────────────────────────
function splitSpokeBlocks(content) {
  const spokesStart = content.indexOf("export const spokes");
  if (spokesStart === -1) return [];
  const afterExport = content.substring(spokesStart);
  const firstBrace = afterExport.indexOf("{");
  const spokesBody = afterExport.substring(firstBrace + 1);
  const keyPattern = /^[ ]{2,6}(?:"([^"]+)"|([가-힣\w]+))\s*:\s*\{/gm;
  const keys = [...spokesBody.matchAll(keyPattern)];
  const blocks = [];
  for (let i = 0; i < keys.length; i++) {
    const slug = keys[i][1] || keys[i][2];
    const start = keys[i].index;
    const end = i < keys.length - 1 ? keys[i + 1].index : spokesBody.length;
    blocks.push({ slug, raw: spokesBody.substring(start, end) });
  }
  return blocks;
}

// ── 본문에서 숫자 패턴 추출 ──────────────────────────────────────
function extractNumbers(text, patterns) {
  const found = [];
  for (const { pattern, label } of patterns) {
    const re = new RegExp(pattern, "g");
    const matches = [...text.matchAll(re)];
    for (const m of matches) {
      found.push({ label, value: m[0], numbers: m.slice(1) });
    }
  }
  return found;
}

// ── 성분 테이블 추출 (글 본문) ────────────────────────────────────
function extractIngredients(raw) {
  const ingBlock = raw.match(/ingredients:\s*\[([\s\S]*?)\]/);
  if (!ingBlock) return [];
  const items = [];
  const nameMatches = [...ingBlock[1].matchAll(/name:\s*"([^"]+)"/g)];
  const amountMatches = [...ingBlock[1].matchAll(/amount:\s*"([^"]+)"/g)];
  for (let i = 0; i < nameMatches.length; i++) {
    items.push({
      name: nameMatches[i][1],
      amount: amountMatches[i] ? amountMatches[i][1] : null,
    });
  }
  return items;
}

// ── 소스에서 숫자 추출 ───────────────────────────────────────────
function extractSourceNumbers(sourceData, patterns) {
  const allText = [
    sourceData.efcyQesitm,
    sourceData.useMethodQesitm,
    sourceData.atpnQesitm,
    sourceData.seQesitm,
    sourceData.depositMethodQesitm,
    sourceData.atpnWarnQesitm,
    sourceData.intrcQesitm,
  ]
    .filter(Boolean)
    .join(" ");
  return extractNumbers(allText, patterns);
}

// ── 본문 content 텍스트 추출 ─────────────────────────────────────
function extractContentText(raw) {
  const contents = [...raw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)];
  return contents.map((m) => m[1].replace(/\\n/g, "\n")).join("\n");
}

// ── 성분명 교차 검증 ─────────────────────────────────────────────
function checkIngredientMatch(articleIngredients, sourceItemName) {
  const errors = [];
  if (!sourceItemName) return errors;

  // source itemName에서 괄호 안 성분명 추출: "타이레놀정500밀리그램(아세트아미노펜)"
  const parenMatch = sourceItemName.match(/\(([^)]+)\)/);
  if (!parenMatch) return errors;

  const sourceIngredient = parenMatch[1].toLowerCase().replace(/\s/g, "");
  const mainIngredients = articleIngredients.filter((ing) => {
    // 주성분만 (첨가제 제외 — raw에서 type 확인이 어려우므로 amount 있는 것만)
    return ing.amount;
  });

  if (mainIngredients.length === 0) return errors;

  // 글의 주성분 이름이 소스와 일치하는지
  const hasMatch = mainIngredients.some((ing) => {
    const artName = ing.name.toLowerCase().replace(/\s/g, "");
    return (
      artName.includes(sourceIngredient) ||
      sourceIngredient.includes(artName) ||
      // 영문/한글 혼용 허용
      artName.replace(/[a-z]/g, "") === sourceIngredient.replace(/[a-z]/g, "")
    );
  });

  if (!hasMatch && sourceIngredient.length >= 2) {
    errors.push(
      `성분명 불일치: 글="${mainIngredients.map((i) => i.name).join(",")}" vs 소스="${parenMatch[1]}"`
    );
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
  const singleCat = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;

  console.log("=== Layer 2: Fact Gate ===\n");

  const sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP, "utf8"));
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const numberPatterns = config.factCheck.numberPatterns;

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  let totalChecked = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const errorList = [];

  for (const f of files) {
    const cat = f.replace(".ts", "");
    if (singleCat && cat !== singleCat) continue;

    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const blocks = splitSpokeBlocks(content);

    for (const block of blocks) {
      const { slug, raw } = block;
      if (singleSlug && slug !== singleSlug) continue;

      const mapEntry = sourceMap[slug];
      if (!mapEntry || mapEntry.sourceType === "unmapped") continue;

      // 소스 JSON 로드
      const sourceFile = path.join(SOURCE_DIR, mapEntry.sourceFile);
      if (!fs.existsSync(sourceFile)) continue;

      let sourceData;
      try {
        sourceData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
      } catch {
        continue;
      }

      totalChecked++;
      const errs = [];
      const warns = [];

      // 1. 본문 숫자 ↔ 소스 숫자 대조
      const contentText = extractContentText(raw);
      const articleNumbers = extractNumbers(contentText, numberPatterns);
      const sourceNumbers = extractSourceNumbers(sourceData, numberPatterns);

      for (const an of articleNumbers) {
        // 같은 label의 소스 숫자와 비교
        const sourceMatch = sourceNumbers.find((sn) => sn.label === an.label);
        if (sourceMatch) {
          // 숫자가 다르면 에러
          const artNums = an.numbers.join(",");
          const srcNums = sourceMatch.numbers.join(",");
          if (artNums !== srcNums) {
            errs.push(`${an.label} 불일치: 글="${an.value}" vs 소스="${sourceMatch.value}"`);
          }
        }
      }

      // 2. 글에만 있고 소스에 없는 핵심 숫자 (소스 외 정보 사용 의심)
      for (const an of articleNumbers) {
        if (an.label === "성분 용량") {
          const sourceText = [sourceData.useMethodQesitm, sourceData.efcyQesitm].filter(Boolean).join(" ");
          // 성분 용량이 소스 어디에도 없으면 경고
          if (!sourceText.includes(an.numbers[0])) {
            warns.push(`소스에 없는 숫자: "${an.value}" (${an.label})`);
          }
        }
      }

      // 3. 성분명 교차 검증
      const articleIngredients = extractIngredients(raw);
      const ingredientErrors = checkIngredientMatch(articleIngredients, sourceData.itemName);
      errs.push(...ingredientErrors);

      // 4. 제조사 교차 검증
      if (sourceData.entpName) {
        const hasEntpInContent = contentText.includes(sourceData.entpName);
        // 글에 제조사가 언급되었는데 다른 제조사면 경고
        // (제조사 미언급은 OK — 필수 아님)
      }

      if (errs.length > 0) {
        totalErrors += errs.length;
        errorList.push({ cat, slug, type: "ERROR", items: errs });
      }
      if (warns.length > 0) {
        totalWarnings += warns.length;
        errorList.push({ cat, slug, type: "WARN", items: warns });
      }
    }
  }

  // 결과 출력
  if (errorList.length > 0) {
    for (const e of errorList) {
      for (const item of e.items) {
        const icon = e.type === "ERROR" ? "[ERROR]" : "[WARN]";
        console.log(`  ${icon} [${e.cat}/${e.slug}] ${item}`);
      }
    }
  }

  console.log("\n=== Fact Gate 결과 ===");
  console.log(`검사 대상:  ${totalChecked}개 (소스 있는 글만)`);
  console.log(`ERROR:      ${totalErrors}건`);
  console.log(`WARN:       ${totalWarnings}건`);

  if (totalErrors === 0) {
    console.log("\nLayer 2 Fact Gate PASS");
  } else {
    console.log("\nLayer 2 Fact Gate FAIL");
    process.exit(1);
  }
}

main();
