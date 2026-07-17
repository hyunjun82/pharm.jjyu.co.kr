/**
 * verify-price.js
 *
 * draft에서 가격 H2 존재 + 본문 "원" 텍스트 횟수 + 타이틀 "최저가" 검사.
 *
 * 사용법:
 *   node scripts/verify-price.js {slug}
 *   node scripts/verify-price.js --category {cat}    # 카테고리 전수 검사
 *   node scripts/verify-price.js --strict             # 모든 의도에서 "최저가" 100% 강제
 *
 * 출력:
 *   _workspace/{slug}-price.json
 */

const fs = require("fs");
const path = require("path");

const WORKSPACE_DIR = path.resolve(__dirname, "..", "_workspace");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "quality-config.json"), "utf8"));
const MIN_PRICE_MENTIONS = CONFIG.globalRules?.minPriceTextMentions || 3;
const CURRENCY_TOKEN = CONFIG.globalRules?.priceCurrencyToken || "원";

function checkOne(slug, draftText, intent, strict) {
  const issues = [];

  // 1) 가격 H2 존재
  const priceH2 = /title:\s*"[^"]*가격[^"]*"/.test(draftText);
  if (!priceH2) issues.push({ rule: "R4-price-h2", msg: "가격 H2 없음" });

  // 2) 본문 "원" 횟수
  const allContent = (draftText.match(/content:\s*"((?:[^"\\]|\\.)*)"/g) || []).join(" ");
  const wonCount = (allContent.match(new RegExp(CURRENCY_TOKEN, "g")) || []).length;
  const required = intent === "D" ? 5 : MIN_PRICE_MENTIONS;
  if (wonCount < required) {
    issues.push({ rule: "R4-price-mentions", msg: `"${CURRENCY_TOKEN}" 텍스트 ${wonCount}회 (필요 ${required}회)` });
  }

  // 3) 타이틀 "최저가" or "가격" 검사
  const titleMatch = draftText.match(/title:\s*"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : "";
  const hasKeyword = /(최저가|가격)/.test(title);
  if (intent === "D" && !title.includes("최저가")) {
    issues.push({ rule: "R4-title-d", msg: `D형 글인데 title에 "최저가" 없음: ${title}` });
  } else if (strict && !hasKeyword) {
    issues.push({ rule: "R4-title-keyword", msg: `title에 "최저가" 또는 "가격" 없음: ${title}` });
  }

  // 4) priceRange 필드 존재
  const hasPriceRange = /priceRange:\s*\{/.test(draftText);
  if (!hasPriceRange) {
    issues.push({ rule: "R4-priceRange-field", msg: "SpokeArticle.priceRange 필드 없음" });
  }

  return {
    slug,
    intent,
    pass: issues.length === 0,
    wonCount,
    title,
    issues,
  };
}

function readDraft(slug) {
  const file = path.join(WORKSPACE_DIR, `${slug}-draft.ts`);
  if (fs.existsSync(file)) return { text: fs.readFileSync(file, "utf8"), source: "workspace" };

  // workspace에 없으면 data/articles에서 검색 (기존 글 검증용)
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  for (const f of files) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const idx = content.indexOf(`slug: "${slug}"`);
    if (idx === -1) continue;
    const start = content.lastIndexOf("{", idx);
    const depth = 1;
    let end = start + 1;
    let d = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") d++;
      else if (content[i] === "}") {
        d--;
        if (d === 0) { end = i + 1; break; }
      }
    }
    return { text: content.substring(start, end), source: f };
  }
  return null;
}

function inferIntent(draftText) {
  const m = draftText.match(/searchIntent:\s*"([A-F])"/);
  return m ? m[1] : "A"; // 기본 A
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const categoryIdx = args.indexOf("--category");
  const category = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  const slugArg = args.find((a) => !a.startsWith("--") && a !== category);

  if (!category && !slugArg) {
    console.error("Usage: verify-price.js {slug} | --category {cat} [--strict]");
    process.exit(1);
  }

  const slugs = [];
  if (category) {
    const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.startsWith(category));
    for (const f of files) {
      const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
      const matches = [...content.matchAll(/slug:\s*"([^"]+)"/g)];
      matches.forEach((m) => slugs.push(m[1]));
    }
  } else {
    slugs.push(slugArg);
  }

  let pass = 0;
  let fail = 0;
  const failed = [];

  for (const slug of slugs) {
    const draft = readDraft(slug);
    if (!draft) {
      fail++;
      failed.push({ slug, reason: "draft 못 찾음" });
      continue;
    }
    const intent = inferIntent(draft.text);
    const result = checkOne(slug, draft.text, intent, strict);
    if (result.pass) pass++;
    else {
      fail++;
      failed.push(result);
    }

    if (slugs.length === 1) {
      const outFile = path.join(WORKSPACE_DIR, `${slug}-price.json`);
      if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
    }
  }

  console.log(`\n=== verify-price 결과 ===`);
  console.log(`총 ${slugs.length}개 검사, PASS ${pass}, FAIL ${fail}`);
  if (failed.length > 0 && failed.length <= 30) {
    failed.forEach((f) => {
      console.log(`\n  [FAIL] ${f.slug}`);
      (f.issues || []).forEach((i) => console.log(`    - ${i.rule}: ${i.msg}`));
    });
  } else if (failed.length > 30) {
    console.log(`\n  실패 ${failed.length}개 (상위 30개 표시)`);
    failed.slice(0, 30).forEach((f) => console.log(`    - ${f.slug}: ${(f.issues || []).map((i) => i.rule).join(", ")}`));
  }

  if (fail > 0) process.exit(2);
}

main();
