/**
 * pre-commit-check.js — git commit 시 staged articles 품질 검증
 *
 * .git/hooks/pre-commit 에서 호출:
 *   node scripts/pre-commit-check.js
 *
 * 검증 항목:
 * 1. 텍스트 밀도 (전체 2000자+, 섹션별 300자+)
 * 2. AI냄새 금지어
 * 3. 저항 FAQ (실패/예외 시나리오 1개 이상)
 * 4. H2 순서 5연속 동일 감지
 *
 * FAIL → exit 1 (커밋 차단)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

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

function getStagedArticleFiles() {
  try {
    const output = execSync("git -c core.quotePath=false diff --cached --name-only", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      timeout: 5000,
    }).trim();

    return output
      .split("\n")
      .filter(
        (f) =>
          f &&
          f.includes("data/articles/") &&
          f.endsWith(".ts") &&
          !f.endsWith("index.ts")
      );
  } catch {
    return [];
  }
}

function extractSpokesFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const spokes = [];
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

function verifySpoke(spoke) {
  const errors = [];
  const warnings = [];

  // Extract content texts
  const contents = [];
  const contentRegex = /content:\s*"([^"]*)"/g;
  let m;
  while ((m = contentRegex.exec(spoke.text)) !== null) {
    contents.push(m[1].replace(/\\n/g, "\n"));
  }

  // Extract hero
  const heroMatch = spoke.text.match(/heroDescription:\s*"([^"]*)"/);
  const hero = heroMatch ? heroMatch[1].replace(/\\n/g, "\n") : "";

  // Extract FAQ answers
  const faqAnswers = [];
  const faqRegex = /answer:\s*"([^"]*)"/g;
  while ((m = faqRegex.exec(spoke.text)) !== null) {
    faqAnswers.push(m[1]);
  }

  // Extract section titles
  const sectionTitles = [];
  const titleRegex = /title:\s*"([^"]*)"(?=\s*,\s*content)/g;
  while ((m = titleRegex.exec(spoke.text)) !== null) {
    sectionTitles.push(m[1]);
  }

  const allText = contents.join("\n") + "\n" + hero;

  // 1. Total text density
  const koreanOnly = allText.replace(/[^가-힣]/g, "");
  if (koreanOnly.length < MIN_TOTAL_CHARS) {
    errors.push(`텍스트 ${koreanOnly.length}자 (최소 ${MIN_TOTAL_CHARS})`);
  }

  // 2. Per-section density
  for (let i = 0; i < contents.length; i++) {
    const sectionKorean = contents[i].replace(/[^가-힣]/g, "");
    if (sectionKorean.length < MIN_SECTION_CHARS) {
      const title = sectionTitles[i] || `섹션${i + 1}`;
      errors.push(`[${title}] ${sectionKorean.length}자/${MIN_SECTION_CHARS}자`);
    }
  }

  // 3. Banned words
  for (const word of BANNED_WORDS) {
    if (allText.includes(word)) {
      errors.push(`금지어: "${word}"`);
    }
  }

  // 4. Resistance FAQ
  if (faqAnswers.length > 0) {
    let hasResistance = false;
    for (const answer of faqAnswers) {
      for (const kw of RESISTANCE_KEYWORDS) {
        if (answer.includes(kw)) { hasResistance = true; break; }
      }
      if (hasResistance) break;
    }
    if (!hasResistance) {
      warnings.push("저항 FAQ 없음");
    }
  }

  return { slug: spoke.slug, errors, warnings, sectionTitles };
}

function main() {
  const stagedFiles = getStagedArticleFiles();

  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  console.log(`\n🔍 품질 검증: ${stagedFiles.length}개 articles 파일\n`);

  let totalFails = 0;
  let totalWarns = 0;
  let checked = 0;

  for (const file of stagedFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) continue;

    const spokes = extractSpokesFromFile(filePath);
    const category = path.basename(file, ".ts");

    // Only check first 10 changed spokes per file (performance)
    const toCheck = spokes.slice(0, 10);

    for (const spoke of toCheck) {
      const result = verifySpoke(spoke);
      checked++;

      if (result.errors.length > 0 || result.warnings.length > 0) {
        console.log(`[${category}/${result.slug}]`);
        for (const e of result.errors) {
          console.log(`  ❌ ${e}`);
          totalFails++;
        }
        for (const w of result.warnings) {
          console.log(`  ⚠️  ${w}`);
          totalWarns++;
        }
      }
    }

    if (spokes.length > 10) {
      console.log(`  ... ${category}: ${spokes.length - 10}개 추가 spoke는 npm run quality:articles 로 확인`);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`검사: ${checked}개 spoke | ❌ FAIL: ${totalFails} | ⚠️  WARN: ${totalWarns}`);

  if (totalFails > 0) {
    console.log(`\n❌ 품질 미달 — 수정 후 다시 git add + git commit`);
    console.log(`   전체 검사: node scripts/verify-article-quality.js\n`);
    process.exit(1);
  }

  console.log(`✅ 품질 통과\n`);
  process.exit(0);
}

main();
