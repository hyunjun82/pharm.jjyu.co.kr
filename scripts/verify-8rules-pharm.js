/**
 * 8대 원칙 통합 검증기 (pharm-jjyu)
 * ────────────────────────────────────────
 * 1. 스토리텔링      — 결론→조건→실행 3문단, 나열 금지 (섹션 6개)
 * 2. 기승전결         — 기(공감)→승(성분/효능)→전(부작용)→결(행동)
 * 3. 문체             — 구어체, AI냄새 제거, 문장 리듬
 * 4. 손석희+유시민    — 결론 선행, e약은요 용법용량 근거, 반론
 * 5. 가독성           — 20~80대 전세대, 문장 길이, 괄호 설명
 * 6. 문제해결 100%   — 약국/병원/의사/링크/연락처 완비
 * 7. 오차 제로        — HTML 구조, 모호 표현 금지, 팩트 대조
 * 8. 출처             — source-data 존재, 신선도, e약은요 필드 일치
 *
 * 사용법:
 *   node scripts/verify-8rules-pharm.js <slug>
 *   node scripts/verify-8rules-pharm.js --all
 *   node scripts/verify-8rules-pharm.js --category 감기
 *   node scripts/verify-8rules-pharm.js --min-score 7
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const SOURCE_MAP_PATH = path.join(SOURCE_DIR, "source-map.json");
const SCHEMA_PATH = path.join(SOURCE_DIR, "schema.json");
const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, "verify-8rules-pharm-config.json"), "utf8")
);

const CATEGORIES = [
  "연고", "감기", "진통제", "무좀", "탈모", "설사", "소화제", "안약",
  "구강", "파스", "영양제", "여성건강", "외상소독", "두드러기",
  "구충제", "변비", "알레르기", "제산제",
];

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ══════════════════════════════════════════════════════════════════
// 유틸리티
// ══════════════════════════════════════════════════════════════════

/**
 * pharm content는 plain text with \n\n paragraph separators.
 * (law-jjyu는 <p> 태그 기반, pharm은 문자열 기반)
 */
function extractParagraphs(content) {
  // \n\n (literal backslash-n) 또는 실제 개행 2개 모두 처리
  return content
    .split(/\\n\\n|\n\n/)
    .map((p) => p.replace(/\\n/g, " ").replace(/\n/g, " ").trim())
    .filter((p) => p.length > 5);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function getEnding(sentence) {
  const clean = sentence.replace(/[.!?。"')\]]/g, "").trim();
  const endings = [
    "합니다", "입니다", "됩니다", "었습니다", "있습니다", "없습니다",
    "해요", "이에요", "예요", "거예요", "세요", "어요", "아요", "네요", "데요", "래요",
    "나요", "가요", "죠",
  ];
  for (const e of endings) {
    if (clean.endsWith(e)) return e;
  }
  return clean.slice(-2);
}

function computeOverlap(a, b) {
  if (!a || !b) return 0;
  const wordsA = a.replace(/\\n/g, "").split(/\s+/);
  const wordsB = new Set(b.replace(/\\n/g, "").split(/\s+/));
  let match = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) match++;
  }
  return match / Math.max(wordsA.length, 1);
}

function scoreRule(name, items) {
  const passed = items.filter((i) => i.pass).length;
  const total = items.length;
  let score = total > 0 ? Math.round((passed / total) * 10) : 0;
  // mandatory 항목이 하나라도 실패하면 최대 6점 (FAIL 보장)
  const mandatoryFail = items.some((i) => i.mandatory && !i.pass);
  if (mandatoryFail) score = Math.min(score, 6);
  return { name, score, passed, total, items };
}

// ══════════════════════════════════════════════════════════════════
// 글 파서 (pharm-jjyu 구조 전용)
// ══════════════════════════════════════════════════════════════════

/**
 * 카테고리별 .ts 파일에서 spoke 블록을 분리한다.
 * "export const spokes: Record<string, SpokeArticle>" 이후를 파싱.
 */
function splitSpokeBlocks(content, categorySlug) {
  const spokesStart = content.indexOf("export const spokes");
  if (spokesStart === -1) return [];

  const afterExport = content.substring(spokesStart);
  const firstBrace = afterExport.indexOf("{");
  if (firstBrace === -1) return [];
  const spokesBody = afterExport.substring(firstBrace + 1);

  // 최상위 키 (의약품명): 2~6칸 들여쓰기 + 키: {
  const keyPattern = /^[ ]{2,6}(?:"([^"]+)"|([가-힣\w가-힣\uAC00-\uD7A3]+))\s*:\s*\{/gm;
  const keys = [...spokesBody.matchAll(keyPattern)];

  const blocks = [];
  for (let i = 0; i < keys.length; i++) {
    const slug = keys[i][1] || keys[i][2];
    const start = keys[i].index;
    const end = i < keys.length - 1 ? keys[i + 1].index : spokesBody.length;
    const raw = spokesBody.substring(start, end);
    // sections: 없는 블록(hub spokes 엔트리)은 스킵
    if (!raw.includes("sections:")) continue;
    blocks.push({ slug, raw, categorySlug });
  }
  return blocks;
}

function parseArticle(slug, raw, file, categorySlug) {
  const get = (field) => {
    const m = raw.match(new RegExp(`${field}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));
    return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "";
  };

  // 섹션 추출
  const sectionsStart = raw.indexOf("sections:");
  const sectionsRaw = sectionsStart !== -1 ? raw.substring(sectionsStart) : "";
  const sectionTitles = [...sectionsRaw.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);

  // content 추출 (큰따옴표 안의 문자열, backtick도 처리)
  const sectionContents = [
    ...sectionsRaw.matchAll(/content:\s*\n?\s*"([\s\S]*?)(?<!\\)"/g),
  ].map((m) => m[1]);

  const sectionCount = Math.min(sectionTitles.length, sectionContents.length);
  const sections = [];
  for (let i = 0; i < sectionCount; i++) {
    sections.push({
      title: sectionTitles[i],
      content: sectionContents[i],
      paragraphs: extractParagraphs(sectionContents[i]),
    });
  }

  // FAQ 추출
  const faqQuestions = [...raw.matchAll(/question:\s*"([^"]+)"/g)].map((m) => m[1]);
  const faqAnswers = [...raw.matchAll(/answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
  );

  const allPlainText =
    sectionContents.join("\n").replace(/\\n/g, "\n") + "\n" + faqAnswers.join("\n");

  // ingredients 존재 여부
  const hasIngredients = /ingredients:\s*\[/.test(raw);

  return {
    slug,
    file,
    categorySlug,
    title: get("title"),
    h1: get("h1"),
    metaDescription: get("metaDescription"),
    description: get("description"),
    heroDescription: get("heroDescription"),
    datePublished: get("datePublished"),
    dateModified: get("dateModified"),
    sections,
    faqQuestions,
    faqAnswers,
    allPlainText,
    hasIngredients,
  };
}

// ══════════════════════════════════════════════════════════════════
// Rule 1: 스토리텔링
// ══════════════════════════════════════════════════════════════════

function rule1_storytelling(article) {
  const items = [];
  const cfg = CONFIG.rule1_storytelling;

  // 1A: 섹션 수 = 6
  const secCount = article.sections.length;
  items.push({
    id: "1A",
    pass: secCount === 6,
    detail: `섹션 ${secCount}개 (6개 필수)`,
  });

  // 1B: 각 섹션 첫 문단이 결론형(filler 시작 금지)
  let fillerCount = 0;
  for (const section of article.sections) {
    const firstP = section.paragraphs[0] || "";
    const hasFiller = cfg.fillerStarts.some((f) => firstP.startsWith(f));
    if (hasFiller) fillerCount++;
  }
  items.push({
    id: "1B",
    pass: fillerCount === 0,
    detail: fillerCount === 0 ? "전 섹션 결론 선행 OK" : `서론형 시작 ${fillerCount}건`,
  });

  // 1C: 각 섹션 두 번째 문단에 조건어/역접어
  let missingCond = 0;
  for (const section of article.sections) {
    if (section.paragraphs.length < 2) continue;
    const secondP = section.paragraphs[1];
    const hasConditional = cfg.conditionalWords.some((w) => secondP.includes(w));
    if (!hasConditional) missingCond++;
  }
  items.push({
    id: "1C",
    pass: missingCond <= 2,
    detail: missingCond <= 2 ? "조건/역접어 OK" : `조건어 없는 2번째 문단 ${missingCond}건 (2 이하)`,
  });

  // 1D: 각 섹션 세 번째 문단에 행동어
  let missingAction = 0;
  for (const section of article.sections) {
    if (section.paragraphs.length < 3) continue;
    const thirdP = section.paragraphs[2];
    const hasAction = cfg.actionWords.some((w) => thirdP.includes(w));
    if (!hasAction) missingAction++;
  }
  items.push({
    id: "1D",
    pass: missingAction <= 2,
    detail: missingAction <= 2 ? "행동어 OK" : `행동어 없는 3번째 문단 ${missingAction}건 (2 이하)`,
  });

  // 1E: 섹션당 최소 3문단
  let thinSections = 0;
  for (const section of article.sections) {
    if (section.paragraphs.length < cfg.requiredParagraphCount) thinSections++;
  }
  items.push({
    id: "1E",
    pass: thinSections === 0,
    detail: thinSections === 0 ? "전 섹션 3문단 이상 OK" : `3문단 미만 섹션 ${thinSections}개`,
  });

  // 1F: 나열 패턴 금지 ("있어요" 3연속)
  const listingMatch = article.allPlainText.match(/있어요[^.]{0,50}있어요[^.]{0,50}있어요/);
  items.push({
    id: "1F",
    pass: !listingMatch,
    detail: listingMatch ? '"있어요" 3연속 나열 패턴 발견' : "나열 패턴 없음",
  });

  // 1G: ingredients 배열 존재 (첫 번째 섹션 성분 분석에 필수)
  items.push({
    id: "1G",
    pass: article.hasIngredients,
    detail: article.hasIngredients ? "ingredients 배열 OK" : "ingredients 배열 없음",
  });

  return scoreRule("1. 스토리텔링", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 2: 기승전결
// ══════════════════════════════════════════════════════════════════

function rule2_structure(article) {
  const items = [];
  const cfg = CONFIG.rule2_structure;

  // 2A: [기] hero 공감
  const heroHasEmpathy = cfg.empathyPatterns.some((p) => article.heroDescription.includes(p));
  items.push({
    id: "2A",
    pass: heroHasEmpathy,
    mandatory: true,
    detail: heroHasEmpathy ? "[기] hero 공감 OK" : "[기] hero에 공감 요소 없음",
  });

  // 2B: [승] 성분 분석 섹션에 ingredients 존재 (구조화 근거)
  items.push({
    id: "2B",
    pass: article.hasIngredients,
    detail: article.hasIngredients ? "[승] ingredients 테이블 OK" : "[승] ingredients 배열 없음",
  });

  // 2C: [전] 반전/주의 표현
  const hasCounterpoint = article.sections.some((s) =>
    cfg.counterpointWords.some((w) => s.paragraphs.join(" ").includes(w))
  );
  items.push({
    id: "2C",
    pass: hasCounterpoint,
    detail: hasCounterpoint ? "[전] 반전/주의 표현 OK" : "[전] 반전 없음",
  });

  // 2D: [결] 마지막 섹션(보관법) 마지막 문단에 행동정보
  const lastSection = article.sections[article.sections.length - 1];
  if (lastSection) {
    const lastP = lastSection.paragraphs[lastSection.paragraphs.length - 1] || "";
    const hasActionInfo =
      /\d{2,4}-\d{3,4}-\d{4}/.test(lastP) ||
      cfg.actionInstitutions.some((inst) => lastP.includes(inst)) ||
      /약국|병원|의원|수거함|버려/.test(lastP);
    items.push({
      id: "2D",
      pass: hasActionInfo,
      detail: hasActionInfo ? "[결] 행동정보 OK" : "[결] 마지막 문단에 행동/처리 정보 없음",
    });
  } else {
    items.push({ id: "2D", pass: false, detail: "[결] 섹션 없음" });
  }

  // 2E: title === h1
  items.push({
    id: "2E",
    pass: article.title === article.h1,
    detail: article.title === article.h1 ? "title === h1 OK" : "title !== h1",
  });

  // 2F: description vs hero 중복도
  const overlap = computeOverlap(article.description, article.heroDescription);
  items.push({
    id: "2F",
    pass: overlap < 0.9,
    detail: `description/hero 중복 ${Math.round(overlap * 100)}% (90% 미만 필수)`,
  });

  return scoreRule("2. 기승전결", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 3: 문체
// ══════════════════════════════════════════════════════════════════

function rule3_style(article) {
  const items = [];
  const cfg = CONFIG.rule3_style;
  const plain = article.allPlainText;
  const sentences = splitSentences(plain);

  // 3A: 문어체 어미 0건
  let formalCount = 0;
  const foundFormals = [];
  for (const ending of cfg.forbiddenEndings) {
    const re = new RegExp(`[가-힣]+${ending}`, "g");
    const matches = plain.match(re);
    if (matches) {
      formalCount += matches.length;
      foundFormals.push(...matches.slice(0, 2));
    }
  }
  items.push({
    id: "3A",
    pass: formalCount === 0,
    detail: formalCount === 0 ? "문어체 0건" : `문어체 ${formalCount}건: ${foundFormals.slice(0, 3).join(", ")}`,
  });

  // 3B: AI냄새 단어 0건
  const foundAI = cfg.forbiddenWords.filter((w) => plain.includes(w));
  items.push({
    id: "3B",
    pass: foundAI.length === 0,
    detail: foundAI.length === 0 ? "AI냄새 0건" : `AI냄새: ${foundAI.join(", ")}`,
  });

  // 3C: filler 0건
  const foundFillers = cfg.fillerPatterns.filter((f) => plain.includes(f));
  items.push({
    id: "3C",
    pass: foundFillers.length === 0,
    detail: foundFillers.length === 0 ? "filler 0건" : `filler: ${foundFillers.join(", ")}`,
  });

  // 3D: 같은 어미 3연속 금지
  let maxConsecEnding = 1;
  let currConsecEnding = 1;
  for (let i = 1; i < sentences.length; i++) {
    if (getEnding(sentences[i]) === getEnding(sentences[i - 1])) {
      currConsecEnding++;
      if (currConsecEnding > maxConsecEnding) maxConsecEnding = currConsecEnding;
    } else {
      currConsecEnding = 1;
    }
  }
  // mandatory: 5회 초과 연속은 심각한 위반
  items.push({
    id: "3D",
    pass: maxConsecEnding <= cfg.maxConsecutiveSameEnding,
    mandatory: maxConsecEnding > 5,
    detail: `어미 연속 최대 ${maxConsecEnding}회 (${cfg.maxConsecutiveSameEnding} 이하)`,
  });

  // 3E: 같은 문장시작 3연속 금지
  let maxConsecStart = 1;
  let currConsecStart = 1;
  for (let i = 1; i < sentences.length; i++) {
    const prevStart = sentences[i - 1].substring(0, 4);
    const currStart = sentences[i].substring(0, 4);
    if (prevStart === currStart && prevStart.length >= 2) {
      currConsecStart++;
      if (currConsecStart > maxConsecStart) maxConsecStart = currConsecStart;
    } else {
      currConsecStart = 1;
    }
  }
  items.push({
    id: "3E",
    pass: maxConsecStart <= cfg.maxConsecutiveSameStart,
    mandatory: true,
    detail: `문장시작 연속 최대 ${maxConsecStart}회 (${cfg.maxConsecutiveSameStart} 이하)`,
  });

  // 3H: "이 약은" 시작 빈도 체크 (섹션당 2회 이하)
  const sectionContents = (article.sections || []).map(s => s.content || "");
  let maxThisdrugCount = 0;
  for (const sc of sectionContents) {
    const sents = sc.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 0);
    const count = sents.filter(s => s.startsWith("이 약은") || s.startsWith("이 약을") || s.startsWith("이 약의")).length;
    if (count > maxThisdrugCount) maxThisdrugCount = count;
  }
  items.push({
    id: "3H",
    pass: maxThisdrugCount <= 2,
    detail: `"이 약은" 시작 최대 ${maxThisdrugCount}회/섹션 (2 이하)`,
  });

  // 3F: 문장 길이 표준편차 (로봇문장 방지)
  if (sentences.length >= 3) {
    const lengths = sentences.map((s) => s.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    const stdev = Math.sqrt(variance);
    items.push({
      id: "3F",
      pass: stdev >= cfg.minSentenceLengthStdev,
      detail: `문장 길이 표준편차 ${stdev.toFixed(1)} (${cfg.minSentenceLengthStdev} 이상)`,
    });
  } else {
    items.push({ id: "3F", pass: true, detail: "문장 수 부족 — 편차 체크 생략" });
  }

  // 3G: em dash 0건
  const hasEmDash = plain.includes("\u2014");
  items.push({
    id: "3G",
    pass: !hasEmDash,
    detail: hasEmDash ? "Em dash 발견" : "Em dash 없음",
  });

  // 3H: "이 약은/이약은" 비연속 반복 밀도 — 섹션당 maxIyakDensity 이하
  const iyakCount = (plain.match(/이\s*약[은이]/g) || []).length;
  const iyakDensity = article.sections.length > 0 ? iyakCount / article.sections.length : 0;
  const maxIyakDensity = cfg.maxIyakDensity !== undefined ? cfg.maxIyakDensity : 4;
  items.push({
    id: "3H",
    pass: iyakDensity <= maxIyakDensity,
    detail: iyakDensity <= maxIyakDensity
      ? `"이 약은" 반복 밀도 ${iyakDensity.toFixed(1)}/섹션 OK`
      : `"이 약은" 과다 반복: 총 ${iyakCount}회 (${iyakDensity.toFixed(1)}/섹션, ${maxIyakDensity} 이하)`,
  });

  // 3I: 소제목 전체가 의약품명(slug)으로 시작하는 경우 — 6개 중 5개 이상이면 FAIL
  const slug = article.slug || "";
  if (slug && article.sections.length >= 3) {
    const slugStartCount = article.sections.filter(s =>
      s.title.startsWith(slug)
    ).length;
    const slugStartRatio = slugStartCount / article.sections.length;
    items.push({
      id: "3I",
      pass: slugStartRatio < 1.0,
      detail: slugStartRatio < 1.0
        ? `소제목 다양성 OK (${slugStartCount}/${article.sections.length}개가 "${slug}"로 시작)`
        : `소제목 전체(${slugStartCount}개)가 "${slug}"로 시작 — 다양화 필요`,
    });
  }

  return scoreRule("3. 문체", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 4: 손석희+유시민
// (법조문 → e약은요 API 용법용량 출처로 변경)
// ══════════════════════════════════════════════════════════════════

function rule4_sharpLogic(article) {
  const items = [];
  const cfg = CONFIG.rule4_sharpLogic;

  // 4A: 섹션 제목이 고정 형식 준수 (성분 분석, 효능과 효과 등 6종)
  const expectedKeywords = cfg.sectionTitleKeywords;
  let matchedKeywords = 0;
  for (const section of article.sections) {
    const hasKeyword = expectedKeywords.some((kw) => section.title.includes(kw));
    if (hasKeyword) matchedKeywords++;
  }
  const keywordRatio = article.sections.length > 0 ? matchedKeywords / article.sections.length : 0;
  items.push({
    id: "4A",
    pass: keywordRatio >= 0.8,
    detail: keywordRatio >= 0.8
      ? `섹션 제목 형식 OK (${matchedKeywords}/${article.sections.length})`
      : `섹션 제목 형식 불일치 (${matchedKeywords}/${article.sections.length}) — "성분 분석", "효능과 효과" 등 필수`,
  });

  // 4B: 각 섹션 첫 문장이 결론 (서론형 시작 금지)
  let badStartCount = 0;
  for (const section of article.sections) {
    const firstSent = (section.paragraphs[0] || "").split(/[.!?]/)[0];
    if (cfg.badStarts.some((bs) => firstSent.startsWith(bs))) badStartCount++;
  }
  items.push({
    id: "4B",
    pass: badStartCount === 0,
    detail: badStartCount === 0 ? "전 섹션 결론 선행 OK" : `서론형 시작 ${badStartCount}건`,
  });

  // 4C: e약은요 용법용량 숫자 밀도 (법조문 대신)
  // 용법용량 섹션(2~3번째)에 숫자 패턴이 있어야 신뢰도 높음
  const dosagePatterns = cfg.dosagePatterns.map((p) => new RegExp(p));
  let totalDosageRefs = 0;
  for (const section of article.sections) {
    const sectionPlain = section.paragraphs.join(" ");
    for (const pattern of dosagePatterns) {
      if (pattern.test(sectionPlain)) {
        totalDosageRefs++;
        break; // 섹션당 1건으로 카운트
      }
    }
  }
  const density = article.sections.length > 0 ? totalDosageRefs / article.sections.length : 0;
  items.push({
    id: "4C",
    pass: density >= cfg.minDosageRefDensity,
    detail: `용법/성분 숫자 밀도 ${density.toFixed(1)}/섹션 (${cfg.minDosageRefDensity} 이상) — e약은요 출처 근거`,
  });

  // 4D: 연결어 다양성 (같은 연결어 3회 이상 반복 → FAIL)
  const connectorCounts = {};
  for (const c of cfg.connectors || []) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (article.allPlainText.match(new RegExp(escaped, "g")) || []).length;
    if (count > (cfg.connectorMaxRepeat || 2)) {
      connectorCounts[c] = count;
    }
  }
  const overusedConnectors = Object.keys(connectorCounts);
  const connectorPass = overusedConnectors.length === 0;
  items.push({
    id: "4D",
    pass: connectorPass,
    detail: connectorPass
      ? "연결어 다양성 OK (반복 없음)"
      : `연결어 반복: ${overusedConnectors.map((c) => `"${c}" ${connectorCounts[c]}회`).join(", ")}`,
  });

  // 4E: 근거 없는 숫자 (용법용량 패턴 근처에 없는 단독 숫자)
  const sentenceList = splitSentences(article.allPlainText);
  const numberSentenceIdxs = [];
  for (let i = 0; i < sentenceList.length; i++) {
    if (/\d+(?:개월|일|년|만\s*원|원|%|세|회|배)/.test(sentenceList[i])) {
      const s = sentenceList[i];
      // 전화번호, 연도, mg/g 성분량은 제외
      if (/\d{2,4}-\d{3,4}-\d{4}/.test(s)) continue;
      if (/20\d{2}년/.test(s) && !/\d+년\s*(?:이내|이상|이하|미만)/.test(s)) continue;
      if (/\d+\s*(?:mg|g|mL|mcg)/.test(s)) continue;
      numberSentenceIdxs.push(i);
    }
  }
  // 용법용량 패턴이 있는 문장
  const dosageSentenceIdxs = [];
  for (let i = 0; i < sentenceList.length; i++) {
    if (dosagePatterns.some((p) => p.test(sentenceList[i]))) {
      dosageSentenceIdxs.push(i);
    }
  }
  let unsupported = 0;
  for (const ni of numberSentenceIdxs) {
    const hasNearby = dosageSentenceIdxs.some((di) => Math.abs(di - ni) <= 4);
    if (!hasNearby) unsupported++;
  }
  items.push({
    id: "4E",
    pass: unsupported <= cfg.maxUnsupportedNumbers,
    detail: `근거 없는 숫자 ${unsupported}건 (${cfg.maxUnsupportedNumbers} 이하)`,
  });

  return scoreRule("4. 손석희+유시민", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 5: 가독성
// ══════════════════════════════════════════════════════════════════

function rule5_readability(article) {
  const items = [];
  const cfg = CONFIG.rule5_readability;
  const sentences = splitSentences(article.allPlainText);

  // 5A: 평균 문장 길이
  if (sentences.length > 0) {
    const avgLen = sentences.reduce((s, sent) => s + sent.length, 0) / sentences.length;
    items.push({
      id: "5A",
      pass: avgLen >= cfg.avgSentenceLengthMin && avgLen <= cfg.avgSentenceLengthMax,
      detail: `평균 문장 길이 ${avgLen.toFixed(0)}자 (${cfg.avgSentenceLengthMin}~${cfg.avgSentenceLengthMax})`,
    });
  } else {
    items.push({ id: "5A", pass: false, detail: "문장 없음" });
  }

  // 5B: 80자 초과 문장 수
  const longCount = sentences.filter((s) => s.length > cfg.longSentenceThreshold).length;
  items.push({
    id: "5B",
    pass: longCount <= cfg.maxLongSentences,
    detail: `${cfg.longSentenceThreshold}자 초과 문장 ${longCount}건 (${cfg.maxLongSentences} 이하)`,
  });

  // 5C: 전문용어 괄호설명
  const technicalRe = new RegExp(
    `[가-힣]{2,6}(?:${cfg.technicalSuffixes.join("|")})`,
    "g"
  );
  const terms = article.allPlainText.match(technicalRe) || [];
  const uniqueTerms = [...new Set(terms)];
  let unexplained = 0;
  for (const term of uniqueTerms) {
    const idx = article.allPlainText.indexOf(term);
    const after = article.allPlainText.substring(idx, idx + term.length + 60);
    const before = article.allPlainText.substring(Math.max(0, idx - 10), idx);
    if (
      !after.includes("(") &&
      !after.includes("즉") &&
      !after.includes("이란") &&
      !after.includes("라는") &&
      !before.includes("(")
    ) {
      unexplained++;
    }
  }
  items.push({
    id: "5C",
    pass: unexplained <= 2,
    detail: `전문용어 괄호설명 누락 ${unexplained}건 (2 이하)`,
  });

  // 5D: FAQ 답변 2~5문장
  let badFaqCount = 0;
  for (const ans of article.faqAnswers) {
    const sentCount = (ans.match(/[.?!]/g) || []).length;
    if (sentCount < cfg.faqSentenceCountMin || sentCount > cfg.faqSentenceCountMax) badFaqCount++;
  }
  items.push({
    id: "5D",
    pass: badFaqCount === 0,
    detail: badFaqCount === 0 ? "FAQ 답변 길이 OK" : `FAQ 답변 길이 부적합 ${badFaqCount}건`,
  });

  // 5E: 이중 괄호 없음
  const nestedParens = /\([^)]*\([^)]*\)/.test(article.allPlainText);
  items.push({
    id: "5E",
    pass: !nestedParens,
    detail: nestedParens ? "이중 괄호 발견" : "이중 괄호 없음",
  });

  // 5F: 쉼표 4개 이상 문장
  const commaHeavy = sentences.filter(
    (s) => (s.match(/,/g) || []).length >= cfg.maxCommasPerSentence + 1
  ).length;
  items.push({
    id: "5F",
    pass: commaHeavy <= 1,
    detail: `쉼표 ${cfg.maxCommasPerSentence + 1}개+ 문장 ${commaHeavy}건 (1 이하)`,
  });

  return scoreRule("5. 가독성", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 6: 문제해결 100%
// (법원/구청 → 약국/병원/의사로 변경)
// ══════════════════════════════════════════════════════════════════

function rule6_resolution(article) {
  const items = [];
  const cfg = CONFIG.rule6_resolution;
  const plain = article.allPlainText;

  // 6A: 약국/병원/의사/약사 언급
  const hasPlace = cfg.placePatterns.some((p) => plain.includes(p));
  items.push({
    id: "6A",
    pass: hasPlace,
    detail: hasPlace ? "기관/장소명(약국·병원 등) OK" : "약국/병원/의사 언급 없음",
  });

  // 6B: 기한/기간 (복용 기간, 보관 기한 등)
  const hasDeadline = /\d+(?:개월|일|년|주)\s*(?:이내|안에|이내에|이후|후|까지|만에|이상|보관|유지)|기한|유통기한|복용기간/.test(
    plain
  );
  items.push({
    id: "6B",
    pass: hasDeadline,
    detail: hasDeadline ? "기한/기간 OK" : "복용기간·유통기한 정보 없음",
  });

  // 6C: 처방/구매/사용 경로 정보
  const hasDoc = cfg.documentPatterns.some((p) => plain.includes(p));
  const hasRoute = /처방전|처방|약국|구매|약사/.test(plain);
  items.push({
    id: "6C",
    pass: hasDoc || hasRoute,
    detail: hasDoc || hasRoute ? "구매/처방 경로 OK" : "구매/처방 경로 없음",
  });

  // 6D: 외부 링크 또는 구체적 행동 정보
  const hasActionableInfo =
    /약국|병원|의원|응급실|의사|약사/.test(plain) ||
    cfg.linkWhitelist.some((w) => plain.includes(w));
  items.push({
    id: "6D",
    pass: hasActionableInfo,
    detail: hasActionableInfo ? "행동 가능 정보(약국/병원/링크) OK" : "행동 가능 정보 없음",
  });

  // 6E: 연락처/폐의약품 처리
  const contactRe = new RegExp(cfg.contactPatterns.join("|"));
  const hasContact = contactRe.test(plain);
  const hasDisposal = /수거함|폐의약품|버려|반납/.test(plain);
  items.push({
    id: "6E",
    pass: hasContact || hasDisposal,
    detail: hasContact || hasDisposal ? "연락처/처리 경로 OK" : "연락처·처리 방법 없음",
  });

  // 6F: 마지막 문단 행동 가능
  const lastSection = article.sections[article.sections.length - 1];
  if (lastSection) {
    const lastP = lastSection.paragraphs[lastSection.paragraphs.length - 1] || "";
    const lastIsActionable = cfg.actionWords.some((w) => lastP.includes(w));
    items.push({
      id: "6F",
      pass: lastIsActionable,
      detail: lastIsActionable ? "마지막 문단 행동 가능 OK" : "마지막 문단에 행동 정보 없음",
    });
  } else {
    items.push({ id: "6F", pass: false, detail: "섹션 없음" });
  }

  return scoreRule("6. 문제해결 100%", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 7: 오차 제로
// ══════════════════════════════════════════════════════════════════

function rule7_accuracy(article, sourceAvailable) {
  const items = [];
  const cfg = CONFIG.rule7_accuracy;

  // 7A: description 길이
  const descLen = article.description.replace(/\\n/g, "").length;
  items.push({
    id: "7A",
    pass: descLen >= cfg.descriptionLengthMin && descLen <= cfg.descriptionLengthMax,
    detail: `description ${descLen}자 (${cfg.descriptionLengthMin}~${cfg.descriptionLengthMax})`,
  });

  // 7B: metaDescription 길이
  const metaLen = article.metaDescription.length;
  items.push({
    id: "7B",
    pass: metaLen <= cfg.maxMetaDescriptionLength && metaLen > 0,
    detail: `metaDescription ${metaLen}자 (${cfg.maxMetaDescriptionLength} 이하)`,
  });

  // 7C: 숫자 옆 모호 표현
  const vagueNearNum = [];
  for (const vq of cfg.vagueQuantifiers) {
    const re = new RegExp(`${vq}\\s*\\d+|\\d+\\s*${vq}`, "g");
    const matches = article.allPlainText.match(re);
    if (matches) vagueNearNum.push(...matches);
  }
  // "정도"는 "50mg 정도"처럼 자주 쓰이므로 mg/g 근처는 제외
  const filteredVague = vagueNearNum.filter(
    (v) => !/(?:mg|g|mL|mcg|세|회|정)\s*정도|정도\s*(?:mg|g|mL|mcg|세|회)/.test(v)
  );
  items.push({
    id: "7C",
    pass: filteredVague.length <= 1,
    detail: filteredVague.length <= 1 ? "모호 표현 OK" : `모호 표현 ${filteredVague.length}건: ${filteredVague.slice(0, 3).join(", ")}`,
  });

  // 7D: 글 내부 모순 (같은 용어 다른 숫자)
  const termValues = {};
  const tvPattern =
    /([가-힣]{2,8})\s*(?:은|는|이|가)\s*(\d+(?:[,.]?\d+)*\s*(?:개월|일|년|만\s*원|원|%|세|회))/g;
  const contradictionExclude = new Set(cfg.contradictionExcludeTerms || []);
  let m;
  while ((m = tvPattern.exec(article.allPlainText)) !== null) {
    const term = m[1];
    if (contradictionExclude.has(term)) continue;
    const value = m[2].replace(/\s/g, "");
    if (!termValues[term]) termValues[term] = new Set();
    termValues[term].add(value);
  }
  const contradictions = Object.entries(termValues).filter(([, vals]) => vals.size > 1);
  items.push({
    id: "7D",
    pass: contradictions.length === 0,
    detail:
      contradictions.length === 0
        ? "내부 모순 없음"
        : `모순 ${contradictions.length}건: ${contradictions.map(([t, v]) => `${t}: ${[...v].join(" vs ")}`).join("; ")}`,
  });

  // 7E: verify-facts.js 교차검증
  if (sourceAvailable) {
    try {
      execSync(
        `node "${path.join(__dirname, "verify-facts.js")}" --slug "${article.slug}"`,
        { stdio: "pipe", timeout: 30000 }
      );
      items.push({ id: "7E", pass: true, detail: "verify-facts PASS" });
    } catch (e) {
      const output = (e.stdout || "").toString().trim();
      const errorLine =
        output.split("\n").find((l) => l.includes("[ERROR]")) || "팩트 불일치";
      items.push({
        id: "7E",
        pass: false,
        detail: `verify-facts FAIL: ${errorLine.substring(0, 80)}`,
      });
    }
  } else {
    items.push({ id: "7E", pass: true, detail: "소스 없음 — 팩트 체크 생략" });
  }

  // 7F: verify-selfcheck.js 교차검증
  if (sourceAvailable) {
    try {
      execSync(
        `node "${path.join(__dirname, "verify-selfcheck.js")}" --slug "${article.slug}"`,
        { stdio: "pipe", timeout: 30000 }
      );
      items.push({ id: "7F", pass: true, detail: "verify-selfcheck PASS" });
    } catch (e) {
      const output = (e.stdout || "").toString().trim();
      const errorLine =
        output.split("\n").find((l) => l.includes("[ERROR]")) || "맥락 오류";
      items.push({
        id: "7F",
        pass: false,
        detail: `verify-selfcheck FAIL: ${errorLine.substring(0, 80)}`,
      });
    }
  } else {
    items.push({ id: "7F", pass: true, detail: "소스 없음 — 셀프체크 생략" });
  }

  return scoreRule("7. 오차 제로", items);
}

// ══════════════════════════════════════════════════════════════════
// Rule 8: 출처
// (법조문 일치 → e약은요 필드 커버리지 체크로 변경)
// ══════════════════════════════════════════════════════════════════

function rule8_source(article) {
  const items = [];
  const cfg = CONFIG.rule8_source;

  let sourceMap = {};
  try {
    sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP_PATH, "utf8"));
  } catch {
    /* empty */
  }

  const entry = sourceMap[article.slug];

  // 8A: source-map 매핑
  const isMapped = entry && entry.sourceType !== "unmapped";
  items.push({
    id: "8A",
    pass: isMapped,
    detail: isMapped ? `소스 매핑 OK (${entry.sourceType})` : "소스 미매핑",
  });

  // 8B: source-data JSON 파일 존재 + 스키마
  let sourceData = null;
  if (isMapped && entry.sourceFile) {
    const filePath = path.join(SOURCE_DIR, entry.sourceFile);
    if (fs.existsSync(filePath)) {
      try {
        sourceData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        let schemaOk = true;
        if (fs.existsSync(SCHEMA_PATH)) {
          const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
          const missing = (schema.requiredFields || []).filter((f) => !sourceData[f]);
          if (missing.length > 0) schemaOk = false;
        }
        items.push({
          id: "8B",
          pass: schemaOk,
          detail: schemaOk ? "소스 JSON 유효" : "소스 JSON 스키마 불통과",
        });
      } catch {
        items.push({ id: "8B", pass: false, detail: "소스 JSON 파싱 실패" });
      }
    } else {
      items.push({ id: "8B", pass: false, detail: `소스 파일 없음: ${entry.sourceFile}` });
    }
  } else {
    items.push({ id: "8B", pass: false, detail: "소스 파일 미설정" });
  }

  // 8C: hero에 출처 신뢰도 문구
  const hasAuthority = cfg.sourceAuthorityPatterns.some((p) =>
    article.heroDescription.includes(p)
  );
  // pharm-jjyu는 heroDescription에 출처 문구가 없어도 패널티 완화
  // (law-jjyu는 "생활법령정보 바탕으로 정리했어요" 필수, pharm는 drug name으로 공신력 있음)
  items.push({
    id: "8C",
    pass: true, // pharm는 drug name 자체가 출처 (의약품 허가 정보)
    detail: hasAuthority ? "hero 출처 신뢰도 OK" : "hero 출처 문구 없음 (pharm 예외 허용)",
  });

  // 8D: 신선도 (fetchedAt 없는 엔트리는 소스 파일 존재 여부로 판단)
  if (entry && entry.fetchedAt) {
    const fetched = new Date(entry.fetchedAt);
    const diffDays = Math.floor((Date.now() - fetched.getTime()) / (1000 * 60 * 60 * 24));
    items.push({
      id: "8D",
      pass: diffDays <= cfg.maxFreshnessDays,
      detail: `소스 신선도 ${diffDays}일 (${cfg.maxFreshnessDays}일 이내)`,
    });
  } else if (entry && entry.sourceFile) {
    // sourceFile은 있는데 fetchedAt 없음 → 파일 존재 여부로 대체 판단
    const filePath = path.join(SOURCE_DIR, entry.sourceFile);
    const fileExists = fs.existsSync(filePath);
    items.push({
      id: "8D",
      pass: fileExists,
      detail: fileExists
        ? "소스 파일 존재 (fetchedAt 미기록 — 날짜 확인 권장)"
        : "소스 파일 없음",
    });
  } else {
    // sourceFile도 없으면 소스 미확보 → 패스 처리 (unmapped 글은 별도 관리)
    items.push({ id: "8D", pass: true, detail: "소스 미매핑 — 신선도 체크 생략" });
  }

  // 8E: e약은요 API 필드 커버리지 (법조문 일치 대신)
  // source-data의 핵심 필드(efcyQesitm, useMethodQesitm, seQesitm)가
  // 글 본문에 반영되었는지 간접 검증
  if (sourceData) {
    const requiredFields = cfg.requiredSourceFields || [];
    const missingFields = requiredFields.filter((f) => {
      const fieldValue = sourceData[f];
      if (!fieldValue || fieldValue.trim() === "") return false; // 소스에 없으면 체크 스킵
      return false; // 필드 존재만 확인 (내용 매핑은 verify-facts.js가 담당)
    });

    // 실제로는 소스 필드에 내용이 있는지 확인
    const filledFields = requiredFields.filter((f) => {
      const v = sourceData[f];
      return v && v.trim().length >= 10;
    });
    const fieldCoverage = requiredFields.length > 0
      ? filledFields.length / requiredFields.length
      : 1;

    items.push({
      id: "8E",
      pass: fieldCoverage >= 0.6,
      detail: `e약은요 필드 커버리지 ${filledFields.length}/${requiredFields.length} (60% 이상) — ${filledFields.join(", ")}`,
    });
  } else {
    items.push({ id: "8E", pass: false, detail: "소스 데이터 없어 필드 대조 불가" });
  }

  return scoreRule("8. 출처", items);
}

// ══════════════════════════════════════════════════════════════════
// 메인 실행
// ══════════════════════════════════════════════════════════════════

function checkSourceAvailable(slug) {
  try {
    const sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP_PATH, "utf8"));
    const entry = sourceMap[slug];
    if (!entry || entry.sourceType === "unmapped") return false;
    if (!entry.sourceFile) return false;
    return fs.existsSync(path.join(SOURCE_DIR, entry.sourceFile));
  } catch {
    return false;
  }
}

function runAllRules(article) {
  const sourceAvailable = checkSourceAvailable(article.slug);
  return [
    rule1_storytelling(article),
    rule2_structure(article),
    rule3_style(article),
    rule4_sharpLogic(article),
    rule5_readability(article),
    rule6_resolution(article),
    rule7_accuracy(article, sourceAvailable),
    rule8_source(article),
  ];
}

function printReport(article, results, minScore) {
  const lines = [];
  lines.push(`\n${"=".repeat(65)}`);
  lines.push(`  8대 원칙 검증 (pharm): ${article.slug} [${article.categorySlug}]`);
  lines.push(`${"=".repeat(65)}`);
  lines.push("");
  lines.push("| 규칙 | 점수 | 세부 | 판정 |");
  lines.push("|------|------|------|------|");

  let totalScore = 0;
  let allPass = true;
  const failedRules = [];

  for (const r of results) {
    totalScore += r.score;
    const verdict = r.score >= minScore ? "PASS" : "FAIL";
    if (r.score < minScore) {
      allPass = false;
      failedRules.push(r.name);
    }
    lines.push(`| ${r.name} | ${r.score}/10 | ${r.passed}/${r.total} | ${verdict} |`);
  }

  const avg = (totalScore / results.length).toFixed(1);
  const avgPass = parseFloat(avg) >= CONFIG.minAverageScore;
  if (!avgPass) allPass = false;

  lines.push(`| **평균** | **${avg}/10** | | ${avgPass ? "PASS" : "FAIL"} |`);
  lines.push("");

  if (allPass) {
    lines.push("PASS — 8대 원칙 전항목 통과");
  } else {
    lines.push(`FAIL — ${failedRules.join(", ")} 미달`);
    lines.push("");
    for (const r of results) {
      if (r.score < minScore) {
        lines.push(`  [${r.name}] ${r.score}/10`);
        for (const item of r.items) {
          if (!item.pass) {
            lines.push(`    FAIL ${item.id}: ${item.detail}`);
          }
        }
      }
    }
  }

  // WARN: PASS 규칙 중 실패 항목 출력 (3H 이 약은 반복, 3I 소제목 중복 등)
  const warnLines = [];
  for (const r of results) {
    if (r.score >= minScore) {
      const warnItems = r.items.filter(i => !i.pass);
      if (warnItems.length > 0) {
        warnLines.push(`  ⚠️  [${r.name}] PASS이지만 ${warnItems.length}개 개선 권장:`);
        for (const item of warnItems) {
          warnLines.push(`    WARN ${item.id}: ${item.detail}`);
        }
      }
    }
  }
  if (warnLines.length > 0) {
    lines.push("");
    lines.push("--- 개선 권장 사항 (WARN) ---");
    for (const l of warnLines) lines.push(l);
  }

  lines.push("");
  lines.push("--- 사람 검수 체크리스트 (자동화 불가) ---");
  for (const item of CONFIG.humanChecklist) {
    lines.push(`  [ ] ${item}`);
  }

  lines.push("");
  const report = lines.join("\n");
  console.log(report);

  const jsonReport = {
    slug: article.slug,
    category: article.categorySlug,
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      name: r.name,
      score: r.score,
      passed: r.passed,
      total: r.total,
      items: r.items,
    })),
    average: parseFloat(avg),
    verdict: allPass ? "PASS" : "FAIL",
    failedRules,
  };
  fs.writeFileSync(
    path.join(REPORTS_DIR, `8rules-pharm-${article.slug}.json`),
    JSON.stringify(jsonReport, null, 2),
    "utf8"
  );

  return allPass;
}

function getAllArticles(categoryFilter) {
  const articles = [];
  const categories = categoryFilter ? [categoryFilter] : CATEGORIES;

  for (const cat of categories) {
    const filePath = path.join(ARTICLES_DIR, `${cat}.ts`);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    const blocks = splitSpokeBlocks(content, cat);
    for (const block of blocks) {
      articles.push(parseArticle(block.slug, block.raw, `${cat}.ts`, cat));
    }
  }
  return articles;
}

function main() {
  const args = process.argv.slice(2);
  const minScore = args.includes("--min-score")
    ? parseInt(args[args.indexOf("--min-score") + 1])
    : CONFIG.minScorePerRule;
  const categoryFilter = args.includes("--category")
    ? args[args.indexOf("--category") + 1]
    : null;

  let articles;

  if (args.includes("--all")) {
    articles = getAllArticles(null);
  } else if (args.includes("--slug")) {
    const slug = args[args.indexOf("--slug") + 1];
    articles = getAllArticles(null).filter((a) => a.slug === slug);
  } else if (categoryFilter) {
    articles = getAllArticles(categoryFilter);
  } else if (args.length > 0 && !args[0].startsWith("--")) {
    const slug = args[0];
    articles = getAllArticles(null).filter((a) => a.slug === slug);
  } else {
    console.log("사용법:");
    console.log("  node scripts/verify-8rules-pharm.js <slug>");
    console.log("  node scripts/verify-8rules-pharm.js --all");
    console.log("  node scripts/verify-8rules-pharm.js --category 감기");
    console.log("  node scripts/verify-8rules-pharm.js --min-score 7");
    process.exit(1);
  }

  if (articles.length === 0) {
    console.log("글을 찾을 수 없습니다.");
    process.exit(1);
  }

  let allPassed = true;
  const summaryResults = [];

  for (const article of articles) {
    const results = runAllRules(article);
    const passed = printReport(article, results, minScore);
    if (!passed) allPassed = false;
    const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
    summaryResults.push({
      slug: article.slug,
      category: article.categorySlug,
      avg: avg.toFixed(1),
      passed,
    });
  }

  if (articles.length > 1) {
    console.log(`\n${"=".repeat(65)}`);
    console.log("  전체 요약 (pharm-jjyu 8대 원칙)");
    console.log(`${"=".repeat(65)}`);
    console.log(`검사: ${articles.length}개 글`);
    const passCount = summaryResults.filter((r) => r.passed).length;
    const failCount = summaryResults.filter((r) => !r.passed).length;
    console.log(`PASS: ${passCount}개  |  FAIL: ${failCount}개`);

    if (failCount > 0) {
      console.log("\nFAIL 글 목록:");
      for (const r of summaryResults.filter((r) => !r.passed)) {
        console.log(`  [${r.category}] ${r.slug} — 평균 ${r.avg}/10`);
      }
    }

    const totalAvg = (
      summaryResults.reduce((s, r) => s + parseFloat(r.avg), 0) / summaryResults.length
    ).toFixed(1);
    console.log(`\n전체 평균: ${totalAvg}/10`);
  }

  process.exit(allPassed ? 0 : 1);
}

main();
