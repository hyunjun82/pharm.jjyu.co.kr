/**
 * Layer 4: Self-Check Gate — 역방향 검증 (글에서 팩트 역추출 → 소스 대조)
 *
 * 글 본문에서 용법/금기/연령을 역추출하고, 소스 JSON과 교차해서
 * "금지"를 "가능"으로 쓴 맥락 오류를 잡아낸다.
 *
 * 사용법:
 *   node scripts/verify-selfcheck.js               전체 검증
 *   node scripts/verify-selfcheck.js --slug 마데카솔  특정 slug만
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const CONFIG_FILE = path.join(__dirname, "quality-config.json");

// ── spoke 블록 분리 ──────────────────────────────────────────────
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

// ── 본문 content 텍스트 추출 ─────────────────────────────────────
function extractAllContent(raw) {
  const contents = [...raw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)];
  const faq = [...raw.matchAll(/answer:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)];
  return [...contents, ...faq]
    .map((m) => m[1].replace(/\\n/g, "\n"))
    .join("\n");
}

// ── 역추출: 글에서 핵심 팩트 추출 ────────────────────────────────
function reverseExtract(text) {
  const facts = {};

  // 연령제한: "만 N세 이상/이하/미만"
  const ageMatch = text.match(/만\s*(\d+)\s*세\s*(이상|이하|미만|초과)/);
  if (ageMatch) {
    facts.ageLimit = { age: parseInt(ageMatch[1]), direction: ageMatch[2] };
  }

  // 1일 N회
  const dailyMatch = text.match(/1일\s*(\d+)\s*회/);
  if (dailyMatch) {
    facts.dosagePerDay = parseInt(dailyMatch[1]);
  }

  // 1회 N정/캡슐
  const perTimeMatch = text.match(/1회\s*(\d+)\s*(?:정|캡슐|포|mL|밀리리터)/);
  if (perTimeMatch) {
    facts.dosagePerTime = parseInt(perTimeMatch[1]);
  }

  // 복용 금지/가능 맥락
  const contraMatches = [...text.matchAll(/(복용하지\s*(?:마|않|말)|복용\s*금지|사용하지\s*마|사용\s*금지)/g)];
  facts.contraindications = contraMatches.map((m) => m[0]);

  // 복용 가능 맥락
  const allowMatches = [...text.matchAll(/(복용해도\s*(?:돼|괜찮|됩)|복용\s*가능|사용해도\s*(?:돼|괜찮))/g)];
  facts.allowances = allowMatches.map((m) => m[0]);

  return facts;
}

// ── 소스에서 동일 팩트 역추출 ────────────────────────────────────
function reverseExtractSource(sourceData) {
  const allText = [
    sourceData.efcyQesitm,
    sourceData.useMethodQesitm,
    sourceData.atpnQesitm,
    sourceData.atpnWarnQesitm,
    sourceData.seQesitm,
    sourceData.intrcQesitm,
    sourceData.depositMethodQesitm,
  ]
    .filter(Boolean)
    .join("\n");

  return reverseExtract(allText);
}

// ── 부정 맥락 대조 ──────────────────────────────────────────────
function checkNegationConflicts(articleText, sourceText, negationPairs) {
  const errors = [];
  for (const [negative, positive] of negationPairs) {
    const articleHasNeg = articleText.includes(negative);
    const articleHasPos = articleText.includes(positive);
    const sourceHasNeg = sourceText.includes(negative);
    const sourceHasPos = sourceText.includes(positive);

    // 소스에서 "금지"인데 글에서 "가능"으로 쓴 경우
    if (sourceHasNeg && !sourceHasPos && articleHasPos && !articleHasNeg) {
      errors.push(`맥락 반전: 소스="${negative}" but 글="${positive}"`);
    }
    // 소스에서 "가능"인데 글에서 "금지"로 쓴 경우
    if (sourceHasPos && !sourceHasNeg && articleHasNeg && !articleHasPos) {
      errors.push(`맥락 반전: 소스="${positive}" but 글="${negative}"`);
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;

  console.log("=== Layer 4: Self-Check Gate ===\n");

  const sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP, "utf8"));
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const negationPairs = config.selfCheck.negationPairs;

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  let totalChecked = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const errorList = [];

  for (const f of files) {
    const cat = f.replace(".ts", "");
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const blocks = splitSpokeBlocks(content);

    for (const block of blocks) {
      const { slug, raw } = block;
      if (singleSlug && slug !== singleSlug) continue;

      const mapEntry = sourceMap[slug];
      if (!mapEntry || mapEntry.sourceType === "unmapped") continue;

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

      const articleText = extractAllContent(raw);
      const sourceAllText = [
        sourceData.efcyQesitm, sourceData.useMethodQesitm, sourceData.atpnQesitm,
        sourceData.atpnWarnQesitm, sourceData.seQesitm, sourceData.intrcQesitm,
        sourceData.depositMethodQesitm,
      ].filter(Boolean).join("\n");

      // 1. 역추출 팩트 대조
      const articleFacts = reverseExtract(articleText);
      const sourceFacts = reverseExtractSource(sourceData);

      // 연령제한 불일치
      if (articleFacts.ageLimit && sourceFacts.ageLimit) {
        if (articleFacts.ageLimit.age !== sourceFacts.ageLimit.age) {
          errs.push(
            `연령제한 불일치: 글="만 ${articleFacts.ageLimit.age}세 ${articleFacts.ageLimit.direction}" vs 소스="만 ${sourceFacts.ageLimit.age}세 ${sourceFacts.ageLimit.direction}"`
          );
        }
        if (articleFacts.ageLimit.direction !== sourceFacts.ageLimit.direction) {
          errs.push(
            `연령방향 반전: 글="${articleFacts.ageLimit.direction}" vs 소스="${sourceFacts.ageLimit.direction}"`
          );
        }
      }

      // 용법 불일치
      if (articleFacts.dosagePerDay && sourceFacts.dosagePerDay) {
        if (articleFacts.dosagePerDay !== sourceFacts.dosagePerDay) {
          errs.push(
            `1일 횟수 불일치: 글="${articleFacts.dosagePerDay}회" vs 소스="${sourceFacts.dosagePerDay}회"`
          );
        }
      }
      if (articleFacts.dosagePerTime && sourceFacts.dosagePerTime) {
        if (articleFacts.dosagePerTime !== sourceFacts.dosagePerTime) {
          errs.push(
            `1회 용량 불일치: 글="${articleFacts.dosagePerTime}" vs 소스="${sourceFacts.dosagePerTime}"`
          );
        }
      }

      // 2. 부정 맥락 대조 (금지↔가능 반전)
      const negErrors = checkNegationConflicts(articleText, sourceAllText, negationPairs);
      errs.push(...negErrors);

      // 3. 글에 금기가 있는데 소스에 없는 경우 (허위 정보 의심)
      if (articleFacts.contraindications.length > 0 && sourceFacts.contraindications.length === 0) {
        warns.push("글에 금기사항이 있지만 소스에는 금기 표현 없음 (확인 필요)");
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

  console.log("\n=== Self-Check Gate 결과 ===");
  console.log(`검사 대상:  ${totalChecked}개 (소스 있는 글만)`);
  console.log(`ERROR:      ${totalErrors}건`);
  console.log(`WARN:       ${totalWarnings}건`);

  if (totalErrors === 0) {
    console.log("\nLayer 4 Self-Check Gate PASS");
  } else {
    console.log("\nLayer 4 Self-Check Gate FAIL");
    process.exit(1);
  }
}

main();
