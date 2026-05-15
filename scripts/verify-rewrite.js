#!/usr/bin/env node
/**
 * verify-rewrite.js — v3 리라이트 글 1개 단위 품질 + 사실 검증
 *
 * 사용법:
 *   node scripts/verify-rewrite.js --slug 핀페시아 --category 탈모
 *   node scripts/verify-rewrite.js --category 탈모            # 카테고리 전체
 *
 * 검사 7종:
 *   R1. source 매핑 — 글 주성분이 source-data의 permitItemIngrName과 일치
 *   R2. 임상 수치 사실 — 1mg 글에 5mg 임상 수치(8.1·6.4·3.7 등) 섞임
 *   R3. AI 클리셰 — 찾고 계시죠·눈에 띄시죠·걱정되시죠·처음 시작하거나 제품을 바꿀 때
 *   R4. 받침 조사 — 받침 없는 글자 + 은
 *   R5. 출처 표기 — 허가사항·품목번호·위약군 1개 이상
 *   R6. 가격 H2 — sections에 가격 키워드 1개 이상
 *   R7. 헤로 첫 5자 — 같은 카테고리 내 중복
 *
 * 출력: 슬러그별 PASS/FAIL + ERROR/WARN 상세
 * 종료 코드: ERROR 0건이면 0, 1건 이상이면 1 (재작성 트리거)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const argSlug = (() => { const i = args.indexOf("--slug"); return i !== -1 ? args[i + 1] : null; })();
const argCategory = (() => { const i = args.indexOf("--category"); return i !== -1 ? args[i + 1] : null; })();

if (!argCategory) {
  console.error("❌ --category 필수 (예: --category 탈모)");
  process.exit(2);
}

// ── AI 클리셰 ─────────────────────────────────────
const AI_CLICHES = [
  "찾고 계시죠",
  "찾고 있나요",
  "눈에 띄시죠",
  "눈에 띄셨나요",
  "알아보고 계시죠",
  "걱정되시죠",
  "고민되시죠",
  "처음 시작하거나 제품을 바꿀 때",
  "확인해 보셨나요",
  "찾아보셨죠",
  "들으셨죠",
];

// 1mg 글에 섞이면 안 되는 5mg 임상 수치 (피나스테리드 5mg PLESS 임상)
const FIVE_MG_NUMBERS = [
  /발기부전\s*\(?8\.1/,    // 5mg 1년: 발기부전 8.1%
  /성욕감퇴\s*\(?6\.4/,    // 5mg 1년: 성욕감퇴 6.4%
  /사정량감소\s*\(?3\.7/,  // 5mg 1년: 사정량감소 3.7%
  /\b1\.1\s*~\s*8\.1\s*%/, // "1.1~8.1%" 같이 5mg 범위 섞은 표현
  /\b1\.6\s*~\s*6\.4\s*%/,
  /\b0\.4\s*~\s*3\.7\s*%/,
];

// 받침 없는 한글 글자(종성 X) + "은"
function hasNoBatchimEun(text) {
  // 한글 음절: 가(0xAC00) ~ 힣(0xD7A3)
  // 받침 유무: (음절 - 0xAC00) % 28 === 0 이면 받침 없음
  const violations = [];
  const re = /([가-힣])은(?=[\s,.·\(\)·!?:;“”"'\[\]/]|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const code = m[1].charCodeAt(0) - 0xAC00;
    if (code % 28 === 0) {
      const before = text.slice(Math.max(0, m.index - 8), m.index);
      const after = text.slice(m.index, Math.min(text.length, m.index + 6));
      violations.push(`${before}【${m[1]}은】${after.slice(2)}`);
    }
  }
  return violations;
}

// articles 파일에서 모든 spoke entry 추출 (slug, content)
function extractSpokes(category) {
  const dir = path.join(ROOT, "data", "articles");
  const files = fs.readdirSync(dir).filter((f) => new RegExp(`^${category}(-\\d+)?\\.ts$`).test(f));
  const spokes = {};
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf-8");
    // entry 분할: "    슬러그: {" 또는 "    \"슬러그\": {" (2 또는 4 spaces 들여쓰기 모두 허용)
    const entryRegex = /^( {2,4})(["']?)([^"'\s:]+)\2:\s*\{/gm;
    const matches = [];
    let m;
    while ((m = entryRegex.exec(text)) !== null) {
      matches.push({ slug: m[3], start: m.index });
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].start;
      const end = i + 1 < matches.length ? matches[i + 1].start : text.length;
      spokes[matches[i].slug] = { file: f, body: text.slice(start, end) };
    }
  }
  return spokes;
}

function getField(body, fieldName) {
  // heroDescription, title, h1 등 한 줄 또는 여러 줄 문자열 추출
  const re = new RegExp(`${fieldName}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
  const m = re.exec(body);
  return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : null;
}

function getAllContent(body) {
  // sections content + faq answer + heroDescription 모두 합침
  const re = /content:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  const ans = /answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  while ((m = ans.exec(body)) !== null) out.push(m[1]);
  return out.join("\n").replace(/\\n/g, "\n").replace(/\\"/g, '"');
}

function getSectionTitles(body) {
  const sectionsStart = body.indexOf("sections:");
  if (sectionsStart === -1) return [];
  const sectionsBody = body.slice(sectionsStart);
  const re = /title:\s*"([^"]+)"/g;
  const titles = [];
  let m;
  while ((m = re.exec(sectionsBody)) !== null) titles.push(m[1]);
  return titles;
}

function getMainIngredient(body) {
  // ingredients 배열의 주성분 첫 번째
  const re = /\{\s*type:\s*"주성분",\s*name:\s*"([^"]+)"/;
  const m = re.exec(body);
  return m ? m[1] : null;
}

// 슬러그 1개 검증
function verifyOne(slug, body, allHeros) {
  const errors = [];
  const warns = [];

  // R1. source 매핑
  const srcPath = path.join(ROOT, "source-data", `${slug}.json`);
  let src = null;
  if (fs.existsSync(srcPath)) {
    try { src = JSON.parse(fs.readFileSync(srcPath, "utf-8")); } catch { /* skip */ }
  }
  if (!src) {
    warns.push(`R1: source-data/${slug}.json 없음`);
  } else {
    const articleIngr = getMainIngredient(body);
    const srcIngr = src.permitItemIngrName || "";
    if (articleIngr && srcIngr) {
      const ingrMap = {
        "Finasteride": ["피나스테리드"],
        "Dutasteride": ["두타스테리드"],
        "Minoxidil": ["미녹시딜"],
        "Epinastine Hydrochloride": ["에피나스틴"],
      };
      const expected = ingrMap[srcIngr] || [srcIngr];
      const srcLower = srcIngr.toLowerCase();
      const ok = expected.some((kw) => articleIngr.includes(kw)) ||
        (srcLower.includes("finasteride") && articleIngr.includes("피나스테리드")) ||
        (srcLower.includes("dutasteride") && articleIngr.includes("두타스테리드")) ||
        (srcLower.includes("minoxidil") && articleIngr.includes("미녹시딜"));
      if (!ok) errors.push(`R1: 주성분 불일치 — 글="${articleIngr}" vs source.permitItemIngrName="${srcIngr}"`);
    }
    // 카테고리 분류 일치
    const cat = src.permitProductType || "";
    if (cat && !cat.includes("모발") && !cat.includes("발모") && !cat.includes("탈모")) {
      warns.push(`R1: source 카테고리가 모발용제 아님 — "${cat}" (글에 "이 약은 사실 X 치료제" 명시 필요)`);
    }
  }

  // R2. 1mg 글에 5mg 임상수치 섞임
  const isOneMg = body.includes("1mg") || body.includes("1 mg");
  const isFiveMg = body.includes("5mg") || body.includes("5 mg") || body.includes("0.5mg");
  if (isOneMg && !isFiveMg) {
    const allText = getAllContent(body);
    for (const re of FIVE_MG_NUMBERS) {
      if (re.test(allText)) {
        errors.push(`R2: 1mg 글에 5mg 임상 수치 섞임 — 패턴 "${re}"`);
      }
    }
  }

  // R3. AI 클리셰
  const allText = getAllContent(body) + "\n" + (getField(body, "heroDescription") || "");
  for (const cliche of AI_CLICHES) {
    if (allText.includes(cliche)) {
      errors.push(`R3: AI 클리셰 검출 — "${cliche}"`);
    }
  }

  // R4. 받침 조사
  const violations = hasNoBatchimEun(allText);
  if (violations.length > 0) {
    for (const v of violations.slice(0, 3)) {
      errors.push(`R4: 받침 조사 오류 — "${v}"`);
    }
  }

  // R5. 출처 표기
  const sourceKeywords = ["허가사항", "품목번호", "위약군", "임상시험", "식약처"];
  const sourceCount = sourceKeywords.filter((k) => allText.includes(k)).length;
  if (sourceCount === 0) {
    errors.push(`R5: 출처 표기 누락 — 허가사항·품목번호·위약군·임상시험·식약처 중 1개 이상 필요`);
  } else if (sourceCount === 1) {
    warns.push(`R5: 출처 표기 1개 (${sourceCount}/5)`);
  }

  // R6. 가격 H2 섹션
  const titles = getSectionTitles(body);
  const hasPriceSection = titles.some((t) => /가격/.test(t));
  if (!hasPriceSection) {
    errors.push(`R6: 가격 H2 섹션 누락`);
  }

  // R8. title·h1에 "가격" 키워드 필수
  const articleTitle = getField(body, "title") || "";
  const articleH1 = getField(body, "h1") || "";
  if (!/가격/.test(articleTitle)) {
    errors.push(`R8: title에 "가격" 키워드 누락 — "${articleTitle.slice(0, 60)}"`);
  }
  if (!/가격/.test(articleH1)) {
    errors.push(`R8: h1에 "가격" 키워드 누락 — "${articleH1.slice(0, 60)}"`);
  }

  // R7. 헤로 첫 5자 중복
  const hero = getField(body, "heroDescription") || "";
  if (hero) {
    const first5 = hero.replace(/\s+/g, "").slice(0, 5);
    if (allHeros[first5] && allHeros[first5] !== slug) {
      warns.push(`R7: 헤로 첫 5자 "${first5}" 중복 — ${allHeros[first5]}`);
    }
    allHeros[first5] = slug;
    const heroLen = hero.length;
    if (heroLen < 80 || heroLen > 280) {
      warns.push(`R7: 헤로 길이 ${heroLen}자 (권장 80~280)`);
    }
  } else {
    errors.push(`R7: heroDescription 누락`);
  }

  return { errors, warns };
}

// 메인
const spokes = extractSpokes(argCategory);
const targets = argSlug ? { [argSlug]: spokes[argSlug] } : spokes;

if (argSlug && !spokes[argSlug]) {
  console.error(`❌ ${argCategory} 카테고리에 슬러그 "${argSlug}" 없음`);
  process.exit(2);
}

console.log(`\n=== verify-rewrite — ${argCategory}${argSlug ? "/" + argSlug : " 전체"} ===\n`);

const allHeros = {};
let totalE = 0, totalW = 0, totalPass = 0, totalFail = 0;

for (const [slug, info] of Object.entries(targets)) {
  if (!info) continue;
  const { errors, warns } = verifyOne(slug, info.body, allHeros);
  totalE += errors.length;
  totalW += warns.length;
  if (errors.length > 0) totalFail++; else totalPass++;
  const status = errors.length > 0 ? "❌ FAIL" : "✅ PASS";
  if (errors.length === 0 && warns.length === 0) {
    console.log(`${status}  ${slug}`);
  } else {
    console.log(`${status}  ${slug}`);
    for (const e of errors) console.log(`   ERROR ${e}`);
    for (const w of warns) console.log(`   WARN  ${w}`);
  }
}

console.log(`\n=== 결과: PASS ${totalPass} / FAIL ${totalFail} (ERROR ${totalE} · WARN ${totalW}) ===\n`);
process.exit(totalE > 0 ? 1 : 0);
