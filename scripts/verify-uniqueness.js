/**
 * Layer 6: Uniqueness Gate — 글마다 고유 데이터 포인트 3개+ 검증
 *
 * doorway 방지의 다른 한 축. 같은 카테고리 다른 글에 절대 안 나올
 * "고유 사실(factual fingerprint)"을 본문에 박았는지 검사.
 *
 * 추출 패턴:
 *   - 식약처 품목번호 (9자리)
 *   - 출시 연도 / GMP 인증 연도 (1980~현재)
 *   - 알약 모양·각인 (흰색 원형 / "TY" 각인 등)
 *   - 임상시험 표본 수 (예: 1,247명)
 *   - 광고 카피·슬로건 ("맞다 게보린" 류 따옴표 안 한국어)
 *   - 가격 (원, 달러)
 *   - 의약품/건기식 분류 (일반의약품, 전문의약품, 건강기능식품)
 *
 * 검증 룰:
 *   - 글마다 고유 사실 ≥ 3개
 *   - 추출된 사실 중 카테고리 내 다른 글과 겹치지 않는 것 ≥ 2개
 *   - _qa.uniqueFacts에 기록되어 있으면 그것 사용 (writer가 명시 가능)
 *
 * 사용법:
 *   node scripts/verify-uniqueness.js              전체
 *   node scripts/verify-uniqueness.js --category 유산균
 *   node scripts/verify-uniqueness.js --slug 락토핏
 *   node scripts/verify-uniqueness.js --json
 *   node scripts/verify-uniqueness.js --report     사실 매트릭스 출력
 */

const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const CONFIG_FILE = path.join(__dirname, "quality-config.json");

function loadThresholds() {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const u = config.uniqueness || {};
  return {
    minFactsPerArticle: u.minFactsPerArticle ?? 3,
    minUniqueFactsInCategory: u.minUniqueFactsInCategory ?? 2,
  };
}

// ── spoke 분리 (verify-style.js 동일) ───────────────────────────
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

function extractAllText(raw) {
  const sectionContents = [...raw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)].map((m) =>
    m[1].replace(/\\n/g, "\n")
  );
  const faqAnswers = [...raw.matchAll(/answer:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g)].map((m) =>
    m[1].replace(/\\n/g, "\n")
  );
  const heroM = raw.match(/heroDescription:\s*\n?\s*"([\s\S]*?)(?<!\\)"/);
  const hero = heroM ? heroM[1].replace(/\\n/g, "\n") : "";
  return [hero, ...sectionContents, ...faqAnswers].join("\n");
}

function extractQaUniqueFacts(raw) {
  // _qa.uniqueFacts: [...] 가 있으면 추출
  const m = raw.match(/_qa\s*:\s*\{[\s\S]*?uniqueFacts\s*:\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  const inner = m[1];
  const items = [...inner.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return items.length > 0 ? items : null;
}

// ── 고유 사실 후보 추출 ───────────────────────────────────────────
//
// 각 fact는 { type, value, evidence } 형태
//
function extractFactCandidates(text) {
  const facts = [];

  // 1. 품목번호 (9자리 숫자, 또는 "품목번호 OOOOOOOOO" 형식)
  const itemNoPatterns = [
    /품목번호\s*(\d{9})/g,
    /품목허가번호\s*(\d{9,11})/g,
    /제\s*(\d{4}-\d{4,6})\s*호/g, // 제2018-1234호 형식
  ];
  for (const re of itemNoPatterns) {
    for (const m of text.matchAll(re)) {
      facts.push({ type: "ITEM_CODE", value: m[1], evidence: m[0] });
    }
  }

  // 2. 출시 연도 / 인증 연도 (의약품 맥락)
  const yearContextPatterns = [
    /(\d{4})년\s*(?:출시|발매|허가|인증|승인|최초|시판)/g,
    /(?:출시|발매|허가|인증|승인|시판)\s*(\d{4})년/g,
    /GMP\s*(\d{4})/g,
  ];
  for (const re of yearContextPatterns) {
    for (const m of text.matchAll(re)) {
      const y = parseInt(m[1]);
      if (y >= 1960 && y <= 2030) {
        facts.push({ type: "YEAR", value: m[1], evidence: m[0] });
      }
    }
  }

  // 3. 알약 모양·각인
  const pillShapePattern = /(흰색|노란색|분홍색|파란색|초록색|주황색|갈색|빨간색|검은색)?\s*(원형|장방형|타원형|삼각형|마름모|사각형|캡슐형)\s*(?:정제|알약|캡슐|분할정)?/g;
  for (const m of text.matchAll(pillShapePattern)) {
    if (m[0].length >= 4) {
      facts.push({ type: "PILL_SHAPE", value: m[0].trim(), evidence: m[0] });
    }
  }
  // 각인
  const inscriptionPattern = /["']([A-Z0-9\-]{2,8})["']?\s*각인/g;
  for (const m of text.matchAll(inscriptionPattern)) {
    facts.push({ type: "INSCRIPTION", value: m[1], evidence: m[0] });
  }

  // 4. 임상시험 표본 수
  const trialPattern = /(?:임상|시험|연구)\s*(?:시험|에서)?\s*(\d{1,3}(?:,\d{3})*)\s*(?:명|례)/g;
  for (const m of text.matchAll(trialPattern)) {
    const n = parseInt(m[1].replace(/,/g, ""));
    if (n >= 10 && n <= 100000) {
      facts.push({ type: "TRIAL_N", value: m[1], evidence: m[0] });
    }
  }

  // 5. 광고 슬로건 (따옴표 안 한국어 짧은 문구)
  const sloganPattern = /["'"']([가-힣 ]{4,20})["'"']/g;
  for (const m of text.matchAll(sloganPattern)) {
    // 일반 인용이 아닌 슬로건스러운 표현만 (제품 광고 카피 정도)
    if (m[1].length >= 4 && m[1].length <= 20 && !m[1].includes(",")) {
      facts.push({ type: "SLOGAN", value: m[1], evidence: m[0] });
    }
  }

  // 6. 의약품/건기식 분류
  const classPattern = /(일반의약품|전문의약품|건강기능식품|일반건강기능식품)/g;
  for (const m of text.matchAll(classPattern)) {
    facts.push({ type: "CLASSIFICATION", value: m[1], evidence: m[0] });
  }

  // 7. 가격 (구체 수치)
  const pricePattern = /(\d{1,3}(?:,\d{3})*)\s*원\s*(?:내외|수준|선|가량)?/g;
  for (const m of text.matchAll(pricePattern)) {
    const n = parseInt(m[1].replace(/,/g, ""));
    if (n >= 500 && n <= 1000000) {
      facts.push({ type: "PRICE", value: m[1] + "원", evidence: m[0] });
    }
  }

  // 8. 보험 적용
  const insurancePattern = /(보험\s*적용|비급여|급여|보험\s*미적용|보험\s*전환)/g;
  for (const m of text.matchAll(insurancePattern)) {
    facts.push({ type: "INSURANCE", value: m[1].replace(/\s+/g, ""), evidence: m[0] });
  }

  // 9. 식약처 회수·과징금 (있으면 강력한 고유 시그널)
  const recallPattern = /(회수|과징금|행정처분|판매중지|허가취소).*?(\d{4}년|\d+억\s*\d*만?\s*원|\d+,\d{3,})/g;
  for (const m of text.matchAll(recallPattern)) {
    facts.push({ type: "RECALL", value: m[0].substring(0, 50), evidence: m[0] });
  }

  // 중복 제거 (type+value 기준)
  const seen = new Set();
  return facts.filter((f) => {
    const key = `${f.type}::${f.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── 메인 ─────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const singleSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
  const singleCat = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
  const jsonOutput = args.includes("--json");
  const reportMode = args.includes("--report");

  const T = loadThresholds();

  if (!jsonOutput) {
    console.log("=== Layer 6: Uniqueness Gate ===");
    console.log(`임계값: minFactsPerArticle=${T.minFactsPerArticle}, minUniqueInCategory=${T.minUniqueFactsInCategory}`);
    console.log("");
  }

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "build-all.ts");

  const byCategory = new Map();
  for (const f of files) {
    const cat = f.replace(/-\d+\.ts$/, "").replace(/\.ts$/, "");
    if (singleCat && cat !== singleCat) continue;
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const blocks = splitSpokeBlocks(content);
    for (const b of blocks) {
      if (singleSlug && b.slug !== singleSlug) continue;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({ slug: b.slug, raw: b.raw, file: f });
    }
  }

  const errors = [];
  const articleFacts = []; // { cat, slug, facts: [...], uniqueInCategory: [...] }

  // 1. 글마다 fact 추출
  for (const [cat, articles] of byCategory.entries()) {
    // 카테고리 전체에서 fact 빈도 카운트 (다른 글에도 나오는 사실 식별)
    const factFreq = new Map(); // "type::value" → count

    const perArticle = articles.map(({ slug, raw }) => {
      const qaFacts = extractQaUniqueFacts(raw);
      const text = extractAllText(raw);
      const candidates = extractFactCandidates(text);

      // _qa.uniqueFacts가 명시되어 있으면 그것을 우선 사용 (writer가 자기검증한 것)
      const facts = qaFacts
        ? qaFacts.map((v) => ({ type: "QA_DECLARED", value: v, evidence: v }))
        : candidates;

      for (const f of facts) {
        const key = `${f.type}::${f.value}`;
        factFreq.set(key, (factFreq.get(key) || 0) + 1);
      }
      return { slug, facts };
    });

    // 카테고리 내 유일한 사실만 필터링
    for (const a of perArticle) {
      const uniqueInCat = a.facts.filter((f) => {
        const key = `${f.type}::${f.value}`;
        return factFreq.get(key) === 1;
      });
      articleFacts.push({ cat, slug: a.slug, facts: a.facts, uniqueInCategory: uniqueInCat });

      // 룰 체크
      if (a.facts.length < T.minFactsPerArticle) {
        errors.push({
          type: "INSUFFICIENT_FACTS",
          severity: "ERROR",
          cat,
          slug: a.slug,
          detail: `고유 사실 후보 ${a.facts.length}개 < ${T.minFactsPerArticle}`,
        });
      }
      if (uniqueInCat.length < T.minUniqueFactsInCategory) {
        errors.push({
          type: "NOT_UNIQUE_ENOUGH",
          severity: "ERROR",
          cat,
          slug: a.slug,
          detail: `카테고리 내 유일 사실 ${uniqueInCat.length}개 < ${T.minUniqueFactsInCategory} (전체 ${a.facts.length}개)`,
        });
      }
    }
  }

  // 2. report 모드: 매트릭스 출력
  if (reportMode) {
    console.log("\n=== Uniqueness Report ===\n");
    for (const a of articleFacts) {
      console.log(`[${a.cat}/${a.slug}]`);
      console.log(`  전체 사실 ${a.facts.length}개, 카테고리 내 유일 ${a.uniqueInCategory.length}개`);
      for (const f of a.facts.slice(0, 8)) {
        const isUnique = a.uniqueInCategory.includes(f);
        console.log(`    ${isUnique ? "★" : "·"} [${f.type}] ${f.value}`);
      }
      if (a.facts.length > 8) console.log(`    ... +${a.facts.length - 8}개`);
      console.log("");
    }
  }

  // 3. JSON
  if (jsonOutput) {
    console.log(JSON.stringify({ errors, articleFacts: reportMode ? articleFacts : undefined }, null, 2));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  // 4. 일반 출력
  if (errors.length === 0) {
    console.log(`검사 글: ${articleFacts.length}개`);
    console.log("Layer 6 Uniqueness Gate PASS");
    return;
  }

  const byType = {};
  for (const e of errors) byType[e.type] = (byType[e.type] || 0) + 1;
  console.log(`[ERROR] ${errors.length}건:`);
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}건`);
  }
  console.log("");
  console.log("상위 30건:");
  for (const e of errors.slice(0, 30)) {
    console.log(`  [${e.cat}/${e.slug}] ${e.type}: ${e.detail}`);
  }
  if (errors.length > 30) {
    console.log(`  ... (총 ${errors.length}건)`);
  }
  console.log("");
  console.log("Layer 6 Uniqueness Gate FAIL");
  process.exit(1);
}

main();
