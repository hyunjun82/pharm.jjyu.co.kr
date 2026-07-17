#!/usr/bin/env node
/** audit-titles.js — 전체 글 타이틀 품질 전수 진단 + 재작성 큐 생성
 *
 *  배경: 라이브 실측(2026-06-17) 전체 3,469개 타이틀 중
 *   - 40.6%(1,408개)가 레거시 나열형("성분, 효과, 복용법, 부작용, 주의사항") — 클릭 안 되고 도어웨이 신호
 *   - 47.9%(1,663개)가 '가격/최저가' 단어 없음 — 머니 키워드·검색어 일치 실패
 *   - 163개가 45자 초과
 *
 *  규칙(검증기 T1~T5 + master-quality.template.md + quality-config.titleGlobalRules 기준):
 *   L1 레거시 나열형        키워드를 中점/쉼표로 3개+ 단순 나열 (후킹 없음)
 *   L2 가격단어 없음        '가격' 또는 '최저가' 미포함
 *   L3 제품명 선두 아님      slug로 시작하지 않음
 *   L4 길이 위반            28자 미만 또는 45자 초과
 *   L5 가격숫자 포함        타이틀에 '14,000원' 같은 숫자
 *   L6 파이프 과다          | 또는 ㅣ 2회 이상
 *   L7 금지문구            실시간 비교 / 약국별 비교 / 원~
 *   L8 패턴 중복            같은 카테고리에서 동일 어순 패턴 3개+
 *
 *  사용:
 *    node scripts/audit-titles.js            # 전체
 *    node scripts/audit-titles.js 탈모        # 카테고리 접두 한정
 *  출력: _workspace/title-audit.json  (우선순위 정렬된 재작성 큐 + 요약)
 */
const fs = require("fs");
const path = require("path");

const BAN = ["실시간 비교", "약국별 비교", "원~"];
const KW = ["성분", "효능", "효과", "복용법", "사용법", "부작용", "주의사항", "효과까지", "총정리"];

function clen(s) { return [...s].length; }

// 후킹 신호: 질문·궁금증·비교·행동 유발이 있으면 '나열형'으로 보지 않음
const HOOK = /\?|언제|얼마|될까|셀까|날까|할까|좋을까|맞을까|부담|전에|직구|단종|대신|보다|vs|차이|골라|아끼|정말|진짜|있을까|어디/;

function isLegacyList(t) {
  if (HOOK.test(t)) return false; // 후킹 있으면 통과
  // 키워드 사이를 中점(·)·쉼표·가운뎃점으로 잇는 단순 나열이 2회 이상
  const seq = /(성분|효능|효과|복용법|사용법|부작용|주의사항)\s*[·,、|ㅣ\s]\s*(성분|효능|효과|복용법|사용법|부작용|주의사항)\s*[·,、|ㅣ\s]\s*(성분|효능|효과|복용법|사용법|부작용|주의사항)/;
  if (seq.test(t)) return true;
  if (/성분[\s·,].*효과.*부작용.*주의/.test(t)) return true;
  return false;
}

function analyze(slug, title, intent) {
  const reasons = [];
  if (isLegacyList(title)) reasons.push("L1 레거시 나열형(후킹 없음)");
  if (!/가격|최저가/.test(title)) reasons.push("L2 가격단어 없음");
  if (!title.startsWith(slug)) reasons.push("L3 제품명 선두 아님");
  const L = clen(title);
  if (L < 28 || L > 45) reasons.push("L4 길이 " + L + "자(권장 28~45)");
  if (/\d{1,3}(,\d{3})*\s*원/.test(title)) reasons.push("L5 가격숫자 포함");
  if ((title.match(/[|ㅣ]/g) || []).length >= 2) reasons.push("L6 파이프 2회+");
  for (const b of BAN) if (title.includes(b)) reasons.push("L7 금지문구 '" + b + "'");
  return reasons;
}

// 의도별 권장 타이틀 골격 (writer가 본문 가능 범위에서 채움)
const PATTERN = {
  A: "{P} 효과 언제부터? 사용법·부작용과 가격까지",
  B: "{P} 부작용, 즉시 끊어야 할 신호는? 효능·가격까지",
  C: "{P} 올바른 복용법은? 효과·부작용과 가격까지",
  D: "{P} 가격과 한 달 비용, 최저가 확인법까지",
  E: "{P} 비교: 효과·부작용·가격 어디가 나을까",
  F: "{P} 대신 같은 성분 대체약과 최저가는?",
  _: "{P} 효과·부작용·복용법과 가격 총정리",
};

const prefix = process.argv[2] || "";
const dir = "data/articles";
const rows = [];

for (const file of fs.readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
  if (prefix && !file.startsWith(prefix)) continue;
  const src = fs.readFileSync(path.join(dir, file), "utf8");
  const re = /slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"([^"]+)",[\s\S]{0,500}?title:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    const slug = m[1], cat = m[2], title = m[3];
    const intentM = src.slice(m.index, m.index + 1200).match(/searchIntent:\s*"([A-F])"/);
    const intent = intentM ? intentM[1] : "_";
    const reasons = analyze(slug, title, intent);
    if (reasons.length) {
      rows.push({ slug, cat, file, title, intent, reasons, suggest: PATTERN[intent].replace("{P}", slug) });
    }
  }
}

// L8 패턴 중복: 같은 카테고리에서 slug를 {P}로 치환한 어순이 3개+
const patByCat = {};
for (const r of rows) {
  const pat = r.title.split(r.slug).join("{P}");
  patByCat[r.cat] = patByCat[r.cat] || {};
  patByCat[r.cat][pat] = (patByCat[r.cat][pat] || 0) + 1;
}
for (const r of rows) {
  const pat = r.title.split(r.slug).join("{P}");
  if (patByCat[r.cat][pat] >= 3) r.reasons.push("L8 동일 어순 패턴 " + patByCat[r.cat][pat] + "개");
}

rows.sort((a, b) => b.reasons.length - a.reasons.length);

const summary = { scanned_files: prefix || "ALL", flagged: rows.length, byRule: {}, byCat: {} };
["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"].forEach((code) => {
  summary.byRule[code] = rows.filter((r) => r.reasons.some((x) => x.startsWith(code))).length;
});
for (const r of rows) summary.byCat[r.cat] = (summary.byCat[r.cat] || 0) + 1;

fs.mkdirSync("_workspace", { recursive: true });
fs.writeFileSync("_workspace/title-audit.json", JSON.stringify({ summary, queue: rows }, null, 1));

console.log("=== title audit ===");
console.log(JSON.stringify(summary, null, 1));
console.log("\n queue: _workspace/title-audit.json (flagged " + rows.length + ")");
console.log("\n--- worst 12 ---");
rows.slice(0, 12).forEach((r) => {
  console.log(" - [" + r.cat + "] " + r.title);
  console.log("     -> " + r.reasons.join(" / "));
  console.log("     suggest: " + r.suggest);
});
