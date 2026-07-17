#!/usr/bin/env node
/** satisfaction-judge.js — "사용자 중심 만족" 게이트 (토스/뱅크샐러드급 상한선)
 *
 *  기존 기계 게이트(validate/score/human-feel)는 "나쁜 것 제거"(하한선)만 한다.
 *  이 게이트는 "검색자가 이 글 하나로 100% 해결됐나 + 경쟁사보다 나은가"(상한선)를 LLM으로 채점한다.
 *
 *  입력:
 *    node scripts/satisfaction-judge.js {slug} {draft.json} [intentFile]
 *    intentFile 기본값: _workspace/intent/{slug}.json  (사용자질문 수집기가 만든 파일)
 *      형식: { keyword, userQuestions:[...], competitorCovers:[...] }
 *
 *  동작: claude -p 에 [드래프트 + 사용자질문 + 경쟁사커버]를 주고 루브릭 0~100 채점을 받아온다.
 *  종료코드: PASS(>=threshold) 0 / FAIL 1 / claude CLI 없음(스킵) 2
 *  리포트: _workspace/judge/{slug}.json
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const THRESHOLD = 80;       // 토스급 하한 (100점 만점). 미달이면 발행 차단.
const COVERAGE_MIN = 0.8;   // 수집된 사용자질문 중 최소 80% 답해야 함
const MODEL = process.env.JUDGE_MODEL || "sonnet";

const [slug, draftFile, intentArg] = process.argv.slice(2);
if (!slug || !draftFile) { console.error("usage: node scripts/satisfaction-judge.js {slug} {draft.json} [intentFile]"); process.exit(2); }
const intentFile = intentArg || `_workspace/intent/${slug}.json`;

const d = JSON.parse(fs.readFileSync(draftFile, "utf8"));
let intent = { userQuestions: [], competitorCovers: [] };
try { intent = JSON.parse(fs.readFileSync(intentFile, "utf8")); }
catch (e) { console.error(`[경고] intent 파일 없음(${intentFile}) — 사용자질문 없이 일반 만족도만 채점`); }

const body = [d.title, d.heroDescription, ...(d.sections || []).map((s) => "## " + s.title + "\n" + (s.content || "")), ...(d.faq || []).map((f) => "Q " + f.question + "\nA " + f.answer)].join("\n\n");

const rubric = `당신은 토스·뱅크샐러드·KB Think 수준의 콘텐츠 편집장입니다. 아래 글을 "${slug}"을(를) 검색한 사용자 입장에서 냉정하게 채점하세요. 작성자가 하고 싶은 말이 아니라, 검색자가 원하는 답을 줬는지가 기준입니다.

[검색자가 실제로 묻는 질문]
${(intent.userQuestions || []).map((q, i) => (i + 1) + ". " + q).join("\n") || "(수집된 질문 없음 — 일반 검색의도로 판단)"}

[경쟁 상위 글이 답해주는 것 — 우리는 이걸 따라잡거나 넘어야 함]
${(intent.competitorCovers || []).map((c) => "- " + c).join("\n") || "(없음)"}

[채점할 글]
${body.slice(0, 9000)}

다음 5개 항목을 0~100으로 채점하고, 반드시 아래 JSON만 출력하세요(설명 금지):
- q1Answer: 검색 1위 질문에 글 첫머리(서론)에서 즉답했는가
- coverage: 위 검색자 질문 중 본문이 실제로 답한 비율(%)
- vsCompetitor: 경쟁사가 답한 것을 우리도 답하고, 우리만의 가치(고유 데이터·정직한 평가)가 있는가
- userFirst: 작성자중심 군더더기·규정문서 나열이 아니라 사용자 결정에 도움 되는 문장 비율
- nextStep: 읽고 나서 무엇을 할지(가격확인·약국상담 등) 명확한가

출력 형식(정확히):
{"q1Answer":N,"coverage":N,"vsCompetitor":N,"userFirst":N,"nextStep":N,"total":N,"missingQuestions":["답 안 한 검색자 질문"],"verdict":"PASS 또는 FAIL","oneLineFix":"가장 시급한 개선 1가지"}
total은 5개 항목 가중평균(coverage·vsCompetitor 가중 2배). JSON만.`;

// 2026-07-17: LLM 채점 편차 안정화 — JUDGE_RUNS회(기본 3) 반복 채점 후 평균으로 판정.
//   실측 근거: 동일 파일 반복 채점에서 점수 변동 관찰(78→81). 1회 채점은 합불 경계(80)에서 복불복.
const RUNS = Math.max(1, +(process.env.JUDGE_RUNS || 3));
const results = [];
for (let i = 0; i < RUNS; i++) {
  let raw;
  try {
    raw = execSync(`claude -p --model ${MODEL} --output-format text`, { input: rubric, encoding: "utf8", maxBuffer: 1024 * 1024 * 10, timeout: 180000, windowsHide: true, env: { ...process.env, MAX_THINKING_TOKENS: "0" } });
  } catch (e) {
    if (!results.length) { console.error("[스킵] claude CLI 호출 실패(미로그인/미설치):", String(e.message).slice(0, 80)); process.exit(2); }
    break; // 일부 성공분으로 진행
  }
  try { const a = raw.indexOf("{"), b = raw.lastIndexOf("}"); results.push(JSON.parse(raw.slice(a, b + 1))); }
  catch (e) { console.error(`[경고] ${i + 1}회차 응답 파싱 실패`); }
}
if (!results.length) { console.error("[오류] 유효 채점 0회"); process.exit(2); }
const avg = (k) => Math.round(results.reduce((s, x) => s + (+x[k] || 0), 0) / results.length);
const r = {
  q1Answer: avg("q1Answer"), coverage: avg("coverage"), vsCompetitor: avg("vsCompetitor"),
  userFirst: avg("userFirst"), nextStep: avg("nextStep"), total: avg("total"),
  runs: results.length,
  spread: Math.max(...results.map((x) => +x.total || 0)) - Math.min(...results.map((x) => +x.total || 0)),
  missingQuestions: [...new Set(results.flatMap((x) => x.missingQuestions || []))].slice(0, 6),
  verdict: null,
  oneLineFix: (results.find((x) => x.verdict === "FAIL") || results[0]).oneLineFix,
};
if (r.spread > 12) console.log(`[경고] 채점 편차 큼(${r.spread}점) — 루브릭 모호 가능, 결과 신중 해석`);

fs.mkdirSync("_workspace/judge", { recursive: true });
fs.writeFileSync(`_workspace/judge/${slug}.json`, JSON.stringify(r, null, 1));

const coverageOk = (r.coverage || 0) >= COVERAGE_MIN * 100;
const pass = (r.total || 0) >= THRESHOLD && coverageOk && (r.q1Answer || 0) >= 70;

console.log(`[${slug}] 만족 채점(${r.runs}회 평균, 편차 ${r.spread}):`, JSON.stringify({ total: r.total, q1: r.q1Answer, coverage: r.coverage, vsComp: r.vsCompetitor, userFirst: r.userFirst, nextStep: r.nextStep }));
if (r.missingQuestions && r.missingQuestions.length) console.log("  미답 질문:", r.missingQuestions.join(" / "));
if (r.oneLineFix) console.log("  1순위 개선:", r.oneLineFix);

if (!pass) {
  console.log(`SATISFACTION FAIL — 토스급 미달(기준 ${THRESHOLD}점·커버리지 ${COVERAGE_MIN * 100}%). 재작성 필요.`);
  process.exit(1);
}
console.log("SATISFACTION PASS (토스급 사용자 만족 기준 충족)");
