/**
 * Layer 3: Style Gate — 문체/AI냄새/구조/중복 검증
 *
 * 사용법:
 *   node scripts/verify-style.js               전체 검증
 *   node scripts/verify-style.js --slug 마데카솔  특정 slug만
 *   node scripts/verify-style.js --category 감기  카테고리 단위
 */

const fs = require("fs");
const path = require("path");

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

// ── 본문 텍스트 추출 ─────────────────────────────────────────────
function extractSections(raw) {
  const sectionsStart = raw.indexOf("sections:");
  if (sectionsStart === -1) return [];
  const sectionsRaw = raw.substring(sectionsStart);
  const titles = [...sectionsRaw.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
  const contents = [...sectionsRaw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)].map((m) =>
    m[1].replace(/\\n/g, "\n")
  );
  return titles.map((t, i) => ({ title: t, content: contents[i] || "" }));
}

function extractFaqAnswers(raw) {
  return [...raw.matchAll(/answer:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)].map((m) =>
    m[1].replace(/\\n/g, "\n")
  );
}

// ── 문장 분리 ────────────────────────────────────────────────────
function splitSentences(text) {
  return text
    .split(/[.!?。]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

// ── 어미 추출 ────────────────────────────────────────────────────
function getEnding(sentence) {
  const clean = sentence.replace(/[.!?。"')\]]/g, "").trim();
  // 마지막 2~4글자에서 어미 패턴 매칭
  const endings = [
    "합니다", "입니다", "됩니다", "었습니다", "있습니다", "없습니다", "됐습니다", "봅니다", "줍니다",
    "해요", "이에요", "예요", "거예요", "세요", "어요", "아요", "네요", "데요", "래요",
    "할게요", "볼게요", "나요", "가요", "죠",
  ];
  for (const e of endings) {
    if (clean.endsWith(e)) return e;
  }
  return clean.slice(-2);
}

function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
  const singleCat = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;

  console.log("=== Layer 3: Style Gate ===\n");

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const style = config.style;
  const structure = config.structure;

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  let totalChecked = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const errorList = [];

  // FAQ 중복 감지 (전체 글 간)
  const allFaqQuestions = new Map();

  for (const f of files) {
    const cat = f.replace(".ts", "");
    if (singleCat && cat !== singleCat) continue;

    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const blocks = splitSpokeBlocks(content);

    for (const block of blocks) {
      const { slug, raw } = block;
      if (singleSlug && slug !== singleSlug) continue;

      totalChecked++;
      const errs = [];
      const warns = [];
      const sections = extractSections(raw);
      const faqAnswers = extractFaqAnswers(raw);
      const allText = sections.map((s) => s.content).join("\n") + "\n" + faqAnswers.join("\n");

      // ── 1. 금지 어미 (문어체) ──────────────────────────────────
      for (const ending of style.forbiddenEndings) {
        const re = new RegExp(ending, "g");
        const matches = allText.match(re);
        if (matches && matches.length > 0) {
          errs.push(`문어체 "${ending}" ${matches.length}회 발견`);
        }
      }

      // ── 2. AI냄새 단어 ─────────────────────────────────────────
      let forbiddenCount = 0;
      const foundForbidden = [];
      for (const word of style.forbiddenWords) {
        if (allText.includes(word)) {
          forbiddenCount++;
          foundForbidden.push(word);
        }
      }
      if (forbiddenCount > style.maxForbiddenWordCount) {
        errs.push(`AI냄새 단어 ${forbiddenCount}개: ${foundForbidden.join(", ")}`);
      }

      // ── 3. Filler 문장 ─────────────────────────────────────────
      for (const filler of style.fillerPatterns) {
        if (allText.includes(filler)) {
          warns.push(`filler 문장: "${filler}"`);
        }
      }

      // ── 4. 연속 어미 반복 ──────────────────────────────────────
      for (const section of sections) {
        const sentences = splitSentences(section.content);
        let consecutive = 1;
        for (let i = 1; i < sentences.length; i++) {
          const prev = getEnding(sentences[i - 1]);
          const curr = getEnding(sentences[i]);
          if (prev === curr) {
            consecutive++;
            if (consecutive > style.maxConsecutiveSameEnding) {
              warns.push(
                `"${section.title}" 어미 ${consecutive}회 연속 반복: "~${curr}"`
              );
              break;
            }
          } else {
            consecutive = 1;
          }
        }
      }

      // ── 5. 연속 문장 시작 반복 ─────────────────────────────────
      for (const section of sections) {
        const paragraphs = section.content.split("\n\n");
        for (const para of paragraphs) {
          const sentences = splitSentences(para);
          let consecutive = 1;
          for (let i = 1; i < sentences.length; i++) {
            const prevStart = sentences[i - 1].substring(0, 4);
            const currStart = sentences[i].substring(0, 4);
            if (prevStart === currStart && prevStart.length >= 2) {
              consecutive++;
              if (consecutive > style.maxConsecutiveSameStart) {
                warns.push(
                  `"${section.title}" 문장시작 ${consecutive}회 반복: "${currStart}..."`
                );
                break;
              }
            } else {
              consecutive = 1;
            }
          }
        }
      }

      // ── 6. Em dash ─────────────────────────────────────────────
      if (raw.includes("\u2014")) {
        warns.push("Em dash (\u2014) 발견");
      }

      // ── 7. FAQ 중복 (글 간) ────────────────────────────────────
      const faqQuestions = [...raw.matchAll(/question:\s*"([^"]+)"/g)].map((m) => m[1]);
      for (const q of faqQuestions) {
        const normalized = q.replace(/\s+/g, "").replace(/[?？]/g, "");
        if (allFaqQuestions.has(normalized)) {
          warns.push(`FAQ 중복: "${q}" (${allFaqQuestions.get(normalized)}과 동일)`);
        } else {
          allFaqQuestions.set(normalized, `${cat}/${slug}`);
        }
      }

      // ── 8. 섹션간 content 중복 ─────────────────────────────────
      for (let i = 0; i < sections.length; i++) {
        for (let j = i + 1; j < sections.length; j++) {
          const a = sections[i].content.substring(0, 100);
          const b = sections[j].content.substring(0, 100);
          if (a.length > 50 && a === b) {
            errs.push(
              `섹션 content 중복: "${sections[i].title}" = "${sections[j].title}"`
            );
          }
        }
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
  const errorsOnly = errorList.filter((e) => e.type === "ERROR");
  const warnsOnly = errorList.filter((e) => e.type === "WARN");

  if (errorsOnly.length > 0) {
    console.log(`[ERROR] ${totalErrors}건:\n`);
    for (const e of errorsOnly) {
      for (const item of e.items) {
        console.log(`  [${e.cat}/${e.slug}] ${item}`);
      }
    }
  }

  if (warnsOnly.length > 0) {
    console.log(`\n[WARN] ${totalWarnings}건:\n`);
    for (const e of warnsOnly.slice(0, 50)) {
      for (const item of e.items) {
        console.log(`  [${e.cat}/${e.slug}] ${item}`);
      }
    }
    if (warnsOnly.length > 50) {
      console.log(`  ... 외 ${warnsOnly.length - 50}건`);
    }
  }

  console.log("\n=== Style Gate 결과 ===");
  console.log(`검사 대상:  ${totalChecked}개`);
  console.log(`ERROR:      ${totalErrors}건`);
  console.log(`WARN:       ${totalWarnings}건`);

  if (totalErrors === 0) {
    console.log("\nLayer 3 Style Gate PASS");
  } else {
    console.log("\nLayer 3 Style Gate FAIL");
    process.exit(1);
  }
}

main();
