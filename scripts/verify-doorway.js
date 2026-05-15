/**
 * verify-doorway.js
 *
 * draft와 brief.forbiddenSentences의 5-gram overlap 계산.
 * 임계 0.30 초과 시 FAIL.
 *
 * 사용법:
 *   node scripts/verify-doorway.js {slug}
 *
 * 출력:
 *   _workspace/{slug}-doorway.json
 */

const fs = require("fs");
const path = require("path");

const WORKSPACE_DIR = path.resolve(__dirname, "..", "_workspace");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "quality-config.json"), "utf8"));
const THRESHOLD = CONFIG.globalRules?.maxDoorwayOverlap5gram || 0.3;

function tokenize(text) {
  // 한국어 + 영문 단어 단위 토큰화 (공백·문장부호 제거)
  return (text || "")
    .replace(/[^\w가-힣]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function ngrams(tokens, n) {
  const set = new Set();
  for (let i = 0; i <= tokens.length - n; i++) {
    set.add(tokens.slice(i, i + n).join(" "));
  }
  return set;
}

function overlap5gram(textA, textB) {
  const a = ngrams(tokenize(textA), 5);
  const b = ngrams(tokenize(textB), 5);
  if (a.size === 0) return 0;
  let intersect = 0;
  for (const g of a) if (b.has(g)) intersect++;
  return intersect / a.size;
}

function extractContentFromDraft(draftPath) {
  if (!fs.existsSync(draftPath)) return null;
  const raw = fs.readFileSync(draftPath, "utf8");
  // sections.content 모두 추출 (단순 정규식, 한 줄 content만)
  const contents = [...raw.matchAll(/content:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  return contents.join("\n");
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node verify-doorway.js {slug}");
    process.exit(1);
  }

  const briefFile = path.join(WORKSPACE_DIR, `${slug}-brief.json`);
  const draftFile = path.join(WORKSPACE_DIR, `${slug}-draft.ts`);

  if (!fs.existsSync(briefFile)) {
    console.error(`ABORT: ${briefFile} 없음`);
    process.exit(1);
  }
  if (!fs.existsSync(draftFile)) {
    console.error(`ABORT: ${draftFile} 없음`);
    process.exit(1);
  }

  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const draftContent = extractContentFromDraft(draftFile);

  const overlaps = brief.forbiddenSentences.map((f, i) => ({
    index: i,
    sample: f.substring(0, 80),
    overlap: overlap5gram(draftContent, f),
  }));

  const maxOverlap = overlaps.reduce((m, o) => Math.max(m, o.overlap), 0);
  const violators = overlaps.filter((o) => o.overlap >= THRESHOLD);

  const result = {
    slug,
    threshold: THRESHOLD,
    maxOverlap,
    pass: maxOverlap < THRESHOLD,
    overlaps: overlaps.sort((a, b) => b.overlap - a.overlap).slice(0, 10),
    violators,
  };

  const outFile = path.join(WORKSPACE_DIR, `${slug}-doorway.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");

  console.log(`doorway 검사: ${slug}`);
  console.log(`  max 5-gram overlap: ${(maxOverlap * 100).toFixed(1)}% (임계 ${(THRESHOLD * 100).toFixed(0)}%)`);
  console.log(`  ${result.pass ? "✅ PASS" : "❌ FAIL"} — 위반 ${violators.length}건`);

  if (!result.pass) process.exit(2);
}

main();
