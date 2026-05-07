/**
 * Layer 5: Doorway Gate — 카테고리 내 본문 유사도 검증
 *
 * 색인율 1.3% 위기의 핵심 원인. 같은 카테고리 안에서 글끼리 본문이
 * 70% 이상 같으면 구글이 doorway 페이지로 판정하고 색인을 거부함.
 *
 * 검출 항목 (전부 FAIL = 빌드 차단):
 *   - 본문 Jaccard 유사도 > 0.70 (문장 단위 fingerprint)
 *   - 섹션 제목 100% 일치 + 본문 유사도 > 0.50
 *   - heroDescription 첫 5자 카테고리 내 중복
 *   - 동일 문장 4개 이상 공유
 *
 * 사용법:
 *   node scripts/verify-doorway.js                전체
 *   node scripts/verify-doorway.js --category 유산균  카테고리 단위
 *   node scripts/verify-doorway.js --slug 락토핏     특정 slug + 동일 카테고리 비교
 *   node scripts/verify-doorway.js --threshold 0.6   유사도 임계값 조정
 *   node scripts/verify-doorway.js --json            JSON 출력
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const CONFIG_FILE = path.join(__dirname, "quality-config.json");

// ── 임계값 (config에 있으면 그것 사용) ──────────────────────────────
function loadThresholds() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const d = config.doorway || {};
  return {
    bodyJaccard: d.bodyJaccardMax ?? 0.70,
    titleMatchJaccard: d.titleMatchJaccardMax ?? 0.50,
    sharedSentences: d.sharedSentencesMax ?? 4,
    hero5CharsDup: d.hero5CharsDup ?? true,
  };
}

// ── spoke 블록 분리 (verify-style.js와 동일 알고리즘) ───────────────
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

function extractHero(raw) {
  const m = raw.match(/heroDescription:\s*\n?\s*"([\s\S]*?)(?<!\\)"/);
  return m ? m[1].replace(/\\n/g, "\n") : "";
}

// ── 문장 fingerprint ─────────────────────────────────────────────
//
// 한 글의 본문 = sections content + faq answers
// 1) 줄바꿈·문장종료(. ! ? 다 요 죠 까)로 분할
// 2) 각 문장 정규화: 공백 압축, 슬러그명 [SLUG] 토큰으로 마스킹 (제품명 치환 doorway 잡기 위함)
// 3) 5자 미만 문장은 무시
// 4) 각 문장 SHA1 8자 해시 → 정수 set
//
function extractSentences(text, slug) {
  if (!text) return [];
  // 슬러그·제품명 마스킹: 같은 글에서 자기 슬러그가 나오면 [SLUG]로 치환
  // 이렇게 하면 "락토핏 효과는 좋아요" / "듀오락 효과는 좋아요"가 동일 문장으로 잡힘
  const normalized = text
    .replace(new RegExp(escapeRegex(slug), "g"), "[SLUG]")
    .replace(/\s+/g, " ")
    .trim();

  // 문장 분리: . ! ? 또는 한국어 종결어미 + 줄바꿈
  const sentences = normalized
    .split(/(?<=[.!?])\s+|(?<=[다요죠까])\s*\n+|\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10); // 너무 짧은 거 제외 (boilerplate 무관)

  return sentences;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fingerprint(sentence) {
  // 추가 정규화: 숫자는 # 마스킹 (가격 1,200원 / 1,500원 → 동일 문장 잡기)
  const masked = sentence
    .replace(/\d[\d,]*/g, "#")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return crypto.createHash("sha1").update(masked).digest("hex").substring(0, 12);
}

// ── 글 1개의 본문 fingerprint set ───────────────────────────────
function spokeBodyFingerprint(slug, raw) {
  const sections = extractSections(raw);
  const faq = extractFaqAnswers(raw);
  const hero = extractHero(raw);

  const allSentences = [
    ...sections.flatMap((s) => extractSentences(s.content, slug)),
    ...faq.flatMap((a) => extractSentences(a, slug)),
  ];

  const fps = new Set(allSentences.map(fingerprint));
  const sectionTitles = sections.map((s) => s.title);

  return {
    slug,
    fingerprints: fps,
    sentenceCount: allSentences.length,
    sectionTitles,
    sectionTitleSig: sectionTitles.join("||"),
    heroFirst5: hero.substring(0, 5),
    heroDescription: hero,
  };
}

// ── Jaccard 유사도 ──────────────────────────────────────────────
function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  const smaller = setA.size < setB.size ? setA : setB;
  const larger = setA.size < setB.size ? setB : setA;
  for (const x of smaller) if (larger.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function sharedCount(setA, setB) {
  let n = 0;
  const smaller = setA.size < setB.size ? setA : setB;
  const larger = setA.size < setB.size ? setB : setA;
  for (const x of smaller) if (larger.has(x)) n++;
  return n;
}

// ── 메인 ─────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
  const singleCat = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
  const customThreshold = args.includes("--threshold")
    ? parseFloat(args[args.indexOf("--threshold") + 1])
    : null;
  const jsonOutput = args.includes("--json");

  const T = loadThresholds();
  if (customThreshold !== null) T.bodyJaccard = customThreshold;

  if (!jsonOutput) {
    console.log("=== Layer 5: Doorway Gate ===");
    console.log(`임계값: bodyJaccard > ${T.bodyJaccard}, sharedSentences ≥ ${T.sharedSentences}`);
    console.log("");
  }

  // 1. 모든 글 fingerprint 추출 (카테고리별 그룹)
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "build-all.ts");

  // 카테고리 추정: 파일명에서 -N 떼면 카테고리
  const byCategory = new Map(); // cat → [{slug, raw, file}]
  for (const f of files) {
    const cat = f.replace(/-\d+\.ts$/, "").replace(/\.ts$/, "");
    if (singleCat && cat !== singleCat) continue;
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const blocks = splitSpokeBlocks(content);
    for (const b of blocks) {
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({ slug: b.slug, raw: b.raw, file: f });
    }
  }

  const errors = []; // { type, severity, cat, slugA, slugB, score, detail }
  const summary = { categoriesChecked: 0, articlesChecked: 0, pairsChecked: 0 };

  // 2. 카테고리별 fingerprint 계산 + pairwise 비교
  for (const [cat, articles] of byCategory.entries()) {
    summary.categoriesChecked++;
    if (!jsonOutput) console.log(`[${cat}] ${articles.length}개 글 분석 중...`);

    const fps = articles.map(({ slug, raw }) => spokeBodyFingerprint(slug, raw));
    summary.articlesChecked += fps.length;

    // hero 첫 5자 중복 검사
    if (T.hero5CharsDup) {
      const heroMap = new Map(); // first5 → [slug]
      for (const fp of fps) {
        if (fp.heroFirst5.length < 3) continue;
        if (!heroMap.has(fp.heroFirst5)) heroMap.set(fp.heroFirst5, []);
        heroMap.get(fp.heroFirst5).push(fp.slug);
      }
      for (const [first5, slugs] of heroMap.entries()) {
        if (slugs.length > 1) {
          errors.push({
            type: "HERO_FIRST5_DUP",
            severity: "ERROR",
            cat,
            slugs,
            detail: `heroDescription 첫 5자 "${first5}" 중복: ${slugs.join(", ")}`,
          });
        }
      }
    }

    // pairwise 본문 유사도
    for (let i = 0; i < fps.length; i++) {
      if (singleSlug && fps[i].slug !== singleSlug) {
        // singleSlug 모드: i가 singleSlug일 때만 j 전체 비교
        continue;
      }
      for (let j = i + 1; j < fps.length; j++) {
        summary.pairsChecked++;
        const a = fps[i];
        const b = fps[j];

        const sim = jaccard(a.fingerprints, b.fingerprints);
        const shared = sharedCount(a.fingerprints, b.fingerprints);
        const titleMatch = a.sectionTitleSig === b.sectionTitleSig;

        if (sim > T.bodyJaccard) {
          errors.push({
            type: "BODY_TOO_SIMILAR",
            severity: "ERROR",
            cat,
            slugA: a.slug,
            slugB: b.slug,
            score: sim.toFixed(3),
            detail: `본문 Jaccard ${sim.toFixed(3)} > ${T.bodyJaccard} (공유 문장 ${shared}개)`,
          });
        } else if (titleMatch && sim > T.titleMatchJaccard) {
          errors.push({
            type: "TITLE_MATCH_BODY_SIMILAR",
            severity: "ERROR",
            cat,
            slugA: a.slug,
            slugB: b.slug,
            score: sim.toFixed(3),
            detail: `섹션 제목 100% 일치 + 본문 유사도 ${sim.toFixed(3)} > ${T.titleMatchJaccard}`,
          });
        } else if (shared >= T.sharedSentences) {
          errors.push({
            type: "SHARED_SENTENCES",
            severity: "ERROR",
            cat,
            slugA: a.slug,
            slugB: b.slug,
            score: shared,
            detail: `동일 문장 ${shared}개 공유 (≥ ${T.sharedSentences})`,
          });
        }
      }
    }
  }

  // 3. 출력
  if (jsonOutput) {
    console.log(JSON.stringify({ summary, errors }, null, 2));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  console.log("");
  console.log(`검사 카테고리: ${summary.categoriesChecked}`);
  console.log(`검사 글:       ${summary.articlesChecked}`);
  console.log(`pair 비교:     ${summary.pairsChecked.toLocaleString()}`);
  console.log("");

  if (errors.length === 0) {
    console.log("Layer 5 Doorway Gate PASS");
    return;
  }

  // ERROR 유형별 집계
  const byType = {};
  for (const e of errors) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  console.log(`[ERROR] ${errors.length}건:`);
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}건`);
  }
  console.log("");

  // 상위 30건만 자세히
  console.log("상위 30건 상세:");
  for (const e of errors.slice(0, 30)) {
    if (e.slugs) {
      console.log(`  [${e.cat}] ${e.type}: ${e.detail}`);
    } else {
      console.log(`  [${e.cat}] ${e.slugA} vs ${e.slugB} — ${e.detail}`);
    }
  }
  if (errors.length > 30) {
    console.log(`  ... (총 ${errors.length}건, --json으로 전체 출력)`);
  }

  console.log("");
  console.log("Layer 5 Doorway Gate FAIL");
  process.exit(1);
}

main();
