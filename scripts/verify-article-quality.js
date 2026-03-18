#!/usr/bin/env node
/**
 * verify-article-quality.js
 *
 * pharm-jjyu spoke 글 품질 검증 스크립트
 * - 텍스트 밀도 (전체 2000자+, 섹션별 300자+)
 * - AI냄새 금지어 검출
 * - 저항 FAQ 검증
 * - 같은 H2 순서 5연속 감지
 * - 어미 반복 검사
 *
 * Usage: node scripts/verify-article-quality.js [--category 탈모] [--fix]
 */

const fs = require("fs");
const path = require("path");

const BANNED_WORDS = [
  "확인하세요", "체크하세요", "알아보겠습니다", "살펴보겠습니다",
  "또한", "결론적으로", "다양한", "매우 중요",
  "에 대해 알아볼게요", "자세히 살펴볼게요",
  "에 대해 알아보겠습니다", "자세히 살펴보겠습니다",
];

const RESISTANCE_KEYWORDS = [
  "안 되", "안되", "거부", "없으면", "부작용이 나타나",
  "효과가 없", "중단", "실패", "악화", "응급",
  "병원에 가", "의사와 상담", "즉시 중단",
];

const MIN_TOTAL_CHARS = 2000;
const MIN_SECTION_CHARS = 300;

function extractSpokes(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const spokes = [];

  // Simple regex extraction of spoke objects
  const spokeRegex = /["']?([^"':{}\n]+?)["']?\s*:\s*\{[^}]*slug:\s*["']([^"']+)["']/g;
  let match;

  // Use eval-like approach: require the TS as a module won't work, so parse manually
  // Extract heroDescription, sections content, faq from the raw text

  // Split by top-level spoke keys
  const lines = content.split("\n");
  let currentSlug = null;
  let currentBlock = [];
  let depth = 0;
  let inSpokes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("export const spokes")) {
      inSpokes = true;
      depth = 0;
      continue;
    }
    if (!inSpokes) continue;

    for (const ch of line) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }

    currentBlock.push(line);

    if (depth === 1 && line.match(/^\s{2,4}["']?[^"':{}\n]+["']?\s*:\s*\{/)) {
      if (currentSlug && currentBlock.length > 1) {
        spokes.push({ slug: currentSlug, text: currentBlock.slice(0, -1).join("\n") });
      }
      const m = line.match(/^\s{2,4}["']?([^"':{}\n]+?)["']?\s*:\s*\{/);
      currentSlug = m ? m[1].trim() : null;
      currentBlock = [line];
    }

    if (depth <= 0 && inSpokes && i > 10) {
      if (currentSlug) {
        spokes.push({ slug: currentSlug, text: currentBlock.join("\n") });
      }
      break;
    }
  }

  return spokes;
}

function extractContentText(spokeText) {
  // Extract all content: "..." values
  const contents = [];
  const regex = /content:\s*"([^"]*)"/g;
  let m;
  while ((m = regex.exec(spokeText)) !== null) {
    contents.push(m[1].replace(/\\n/g, "\n"));
  }
  return contents;
}

function extractHeroDescription(spokeText) {
  const m = spokeText.match(/heroDescription:\s*"([^"]*)"/);
  if (m) return m[1].replace(/\\n/g, "\n");
  // Multi-line format
  const m2 = spokeText.match(/heroDescription:\s*\n\s*"([^"]*)"/);
  return m2 ? m2[1].replace(/\\n/g, "\n") : "";
}

function extractFaqAnswers(spokeText) {
  const answers = [];
  const regex = /answer:\s*"([^"]*)"/g;
  let m;
  while ((m = regex.exec(spokeText)) !== null) {
    answers.push(m[1]);
  }
  return answers;
}

function extractSectionTitles(spokeText) {
  const titles = [];
  const regex = /title:\s*"([^"]*)"(?=\s*,\s*content)/g;
  let m;
  while ((m = regex.exec(spokeText)) !== null) {
    titles.push(m[1]);
  }
  return titles;
}

function checkBannedWords(text) {
  const found = [];
  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      found.push(word);
    }
  }
  return found;
}

function checkResistanceFaq(faqAnswers) {
  for (const answer of faqAnswers) {
    for (const kw of RESISTANCE_KEYWORDS) {
      if (answer.includes(kw)) return true;
    }
  }
  return false;
}

function checkConsecutiveEndings(text) {
  const sentences = text.split(/[.!?]\s/).filter(s => s.trim().length > 5);
  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < sentences.length; i++) {
    const prevEnding = sentences[i - 1].slice(-3);
    const currEnding = sentences[i].slice(-3);
    if (prevEnding === currEnding) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }
  return maxConsecutive;
}

function verifySpoke(spoke) {
  const errors = [];
  const warnings = [];

  const contents = extractContentText(spoke.text);
  const hero = extractHeroDescription(spoke.text);
  const faqAnswers = extractFaqAnswers(spoke.text);
  const sectionTitles = extractSectionTitles(spoke.text);
  const allText = contents.join("\n") + "\n" + hero;

  // 1. Text density - total
  const koreanOnly = allText.replace(/[^가-힣]/g, "");
  if (koreanOnly.length < MIN_TOTAL_CHARS) {
    errors.push(`텍스트 밀도 부족: ${koreanOnly.length}자 (최소 ${MIN_TOTAL_CHARS}자)`);
  }

  // 2. Text density - per section
  for (let i = 0; i < contents.length; i++) {
    const sectionKorean = contents[i].replace(/[^가-힣]/g, "");
    if (sectionKorean.length < MIN_SECTION_CHARS) {
      const title = sectionTitles[i] || `섹션${i + 1}`;
      errors.push(`[${title}] ${sectionKorean.length}자 (최소 ${MIN_SECTION_CHARS}자)`);
    }
  }

  // 3. Banned words
  const banned = checkBannedWords(allText);
  if (banned.length > 0) {
    errors.push(`AI냄새 금지어: ${banned.join(", ")}`);
  }

  // 4. Resistance FAQ
  if (faqAnswers.length > 0 && !checkResistanceFaq(faqAnswers)) {
    warnings.push("저항 FAQ 없음 (실패/예외 시나리오 1개 이상 필요)");
  }

  // 5. Consecutive endings
  const maxEndings = checkConsecutiveEndings(allText);
  if (maxEndings >= 3) {
    warnings.push(`같은 어미 ${maxEndings}회 연속`);
  }

  return { slug: spoke.slug, errors, warnings, sectionTitles };
}

// Main
const args = process.argv.slice(2);
let targetCategory = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--category" && args[i + 1]) {
    targetCategory = args[i + 1];
    i++;
  }
}

const articlesDir = path.join(__dirname, "..", "data", "articles");
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith(".ts") && f !== "index.ts");

let totalErrors = 0;
let totalWarnings = 0;
let totalSpokes = 0;
let h2OrderMap = {};
let consecutiveSameOrder = 0;
let lastOrder = null;

for (const file of files) {
  const category = file.replace(".ts", "");
  if (targetCategory && category !== targetCategory && !category.startsWith(targetCategory + "-")) continue;

  const filePath = path.join(articlesDir, file);
  const spokes = extractSpokes(filePath);

  if (spokes.length === 0) continue;

  let fileErrors = 0;
  let fileWarnings = 0;

  for (const spoke of spokes) {
    const result = verifySpoke(spoke);
    totalSpokes++;

    // H2 order tracking
    const orderKey = result.sectionTitles.map(t => {
      if (t.includes("성분")) return "성분";
      if (t.includes("효능") || t.includes("효과")) return "효능";
      if (t.includes("사용법") || t.includes("복용법")) return "용법";
      if (t.includes("부작용")) return "부작용";
      if (t.includes("주의사항")) return "주의";
      if (t.includes("보관")) return "보관";
      return t;
    }).join("→");

    if (orderKey === lastOrder) {
      consecutiveSameOrder++;
    } else {
      consecutiveSameOrder = 1;
      lastOrder = orderKey;
    }

    if (consecutiveSameOrder >= 5) {
      result.warnings.push(`H2 순서 ${consecutiveSameOrder}연속 동일: ${orderKey}`);
    }

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`\n[${category}/${result.slug}]`);
      for (const e of result.errors) {
        console.log(`  ❌ FAIL: ${e}`);
        fileErrors++;
      }
      for (const w of result.warnings) {
        console.log(`  ⚠️  WARN: ${w}`);
        fileWarnings++;
      }
    }

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(`총 ${totalSpokes}개 spoke 검사 완료`);
console.log(`❌ FAIL: ${totalErrors}건`);
console.log(`⚠️  WARN: ${totalWarnings}건`);

if (totalErrors > 0) {
  console.log(`\nFAIL이 있으면 수정 없이 다음 파일 불가.`);
  process.exit(1);
}
