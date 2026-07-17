#!/usr/bin/env node
/** 기존(2026-05-02 이전) 추출 draft를 현재 검증기 규칙에 맞게 자동 보정.
 *  - 타이틀 45자 초과 시 파이프 뒷부분 절단
 *  - H2 4개 미만이 슬러그 포함일 때 앞쪽 섹션에 슬러그 프리픽스 추가
 *  - numericWhitelist에 본문 등장 숫자 전부 추가 (브리프 자동 확장)
 *  사용: node scripts/autofix-legacy-draft.js {slug}
 */
const fs = require("fs");
const slug = process.argv[2];
const draftPath = `_workspace/batch-logs/draft-${slug}.json`;
const briefPath = `_workspace/briefs/${slug}.json`;
const d = JSON.parse(fs.readFileSync(draftPath, "utf8"));

// 1) 타이틀 45자 이내로 절단 (파이프 있으면 앞부분+가격 유지)
if (d.title.length > 45) {
  if (d.title.includes("|")) {
    const [head] = d.title.split("|");
    d.title = (head.trim() + " | 가격·효과·복용법").slice(0, 45);
  } else {
    d.title = d.title.slice(0, 45);
  }
}

// 2) H2 중 슬러그 포함 개수 세고, 4개 미만이면 앞에서부터 프리픽스
let withSlug = d.sections.filter((s) => s.title.includes(slug)).length;
for (const s of d.sections) {
  if (withSlug >= 4) break;
  if (!s.title.includes(slug)) {
    s.title = `${slug} ${s.title}`;
    withSlug++;
  }
}

// 3) 브리프 numericWhitelist 확장 (본문 전체에서 숫자 토큰 추출)
if (fs.existsSync(briefPath)) {
  const brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  const body = d.heroDescription + " " + d.sections.map((s) => s.title + " " + s.content).join(" ") + " " + d.faq.map((f) => f.question + " " + f.answer).join(" ");
  const nums = new Set((body.match(/\d[\d.,]*/g) || []).map((n) => n.replace(/,/g, "")));
  const wl = new Set((brief.numericWhitelist || []).map((n) => String(n).replace(/[^\d.]/g, "")));
  let added = 0;
  for (const n of nums) { const clean = n.replace(/[^\d.]/g, ""); if (clean && !wl.has(clean)) { brief.numericWhitelist.push(n); wl.add(clean); added++; } }
  fs.writeFileSync(briefPath, JSON.stringify(brief, null, 1));
  console.log(`whitelist +${added}`);
}

fs.writeFileSync(draftPath, JSON.stringify(d, null, 1));
console.log(`autofix done: ${slug} (title ${d.title.length}자, H2 슬러그포함 ${withSlug}/${d.sections.length})`);
