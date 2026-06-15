#!/usr/bin/env node
/** score-article.js — 표준 11편 대비 품질 점수. 기준 90% 미달 지표가 있으면 FAIL(재작성).
 *  사용:  node scripts/score-article.js --calibrate /tmp/rc-*.json   # 기준점 갱신
 *         node scripts/score-article.js {slug} {draft.json}          # 채점
 *  기준 저장: scripts/quality-benchmark.json (커밋 대상)
 */
const fs = require("fs");
const BM = __dirname + "/quality-benchmark.json";

function metrics(d) {
  const secs = d.sections.map((s) => s.content || "");
  const body = [d.heroDescription, ...secs, ...d.faq.map((f) => f.answer)].join(" ");
  const sents = body.split(/(?<=[.!?])\s/).filter((x) => x.length > 5);
  const endings = body.match(/(해요|예요|이에요|거든요|어요|아요|죠|돼요|네요)(?=[.!?])/g) || [];
  return {
    totalChars: body.length,
    minSection: Math.min(...secs.map((s) => s.length)),
    avgSection: Math.round(secs.reduce((a, b) => a + b.length, 0) / secs.length),
    numPer100: +(((body.match(/\d/g) || []).length / body.length) * 100).toFixed(2),
    citePer1000: +((((body.match(/식약처|허가사항|품목번호|신고번호|임상/g) || []).length) / body.length) * 1000).toFixed(2),
    endingDominance: +(Math.max(...Object.values(endings.reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{0:0}))) / Math.max(endings.length,1)).toFixed(2),
    shortSentRatio: +(sents.filter((s) => s.length <= 25).length / Math.max(sents.length, 1)).toFixed(2),
    sectionCount: secs.length,
    faqCount: d.faq.length,
    heroLen: (d.heroDescription || "").length,
  };
}
const HIGHER_BETTER = ["totalChars", "minSection", "avgSection", "numPer100", "citePer1000", "shortSentRatio", "sectionCount", "faqCount", "heroLen"];
const LOWER_BETTER = ["endingDominance"];

if (process.argv[2] === "--calibrate") {
  const files = process.argv.slice(3);
  const all = files.map((f) => metrics(JSON.parse(fs.readFileSync(f, "utf8"))));
  const bench = {};
  for (const k of HIGHER_BETTER) {
    const v = all.map((m) => m[k]).sort((a, b) => a - b);
    bench[k] = { median: v[Math.floor(v.length / 2)], floor: +(v[Math.floor(v.length / 2)] * 0.9).toFixed(2) };
  }
  for (const k of LOWER_BETTER) {
    const v = all.map((m) => m[k]).sort((a, b) => a - b);
    bench[k] = { median: v[Math.floor(v.length / 2)], ceil: +(v[Math.floor(v.length / 2)] * 1.30).toFixed(2) };
  }
  bench._calibratedFrom = files.length + "편 (v3.1 PASS 표준)";
  bench._date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(BM, JSON.stringify(bench, null, 1));
  console.log("기준점 저장:", BM);
  console.log(JSON.stringify(bench, null, 1));
  process.exit(0);
}

const [slug, draftFile] = process.argv.slice(2);
const bench = JSON.parse(fs.readFileSync(BM, "utf8"));
const m = metrics(JSON.parse(fs.readFileSync(draftFile, "utf8")));
const fails = [];
const KO = { totalChars: "전체 글자수", minSection: "최소 섹션 깊이", avgSection: "평균 섹션 깊이", numPer100: "정보 밀도(숫자)", citePer1000: "출처 인용 밀도", endingDominance: "어미 쏠림(낮을수록 좋음)", shortSentRatio: "문장 리듬(짧은문장)", sectionCount: "섹션 수", faqCount: "FAQ 수", heroLen: "서론 분량" };
for (const k of HIGHER_BETTER) {
  if (m[k] < bench[k].floor) fails.push(`${KO[k]}: ${m[k]} < 기준 ${bench[k].floor} (표준 중앙값 ${bench[k].median})`);
}
for (const k of LOWER_BETTER) {
  if (bench[k] && m[k] > bench[k].ceil) fails.push(`${KO[k]}: ${m[k]} > 허용 ${bench[k].ceil} (표준 중앙값 ${bench[k].median})`);
}
console.log(`[${slug}] 측정:`, JSON.stringify(m));
if (fails.length) {
  console.log("SCORE FAIL — 표준 11편 대비 미달. 재작성 필요:\n- " + fails.join("\n- "));
  process.exit(1);
}
console.log("SCORE PASS ✓ (표준 글 품질 이상)");
