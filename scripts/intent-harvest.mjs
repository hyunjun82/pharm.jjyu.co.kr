#!/usr/bin/env node
/** intent-harvest.mjs — 포털 실측 검색어 수집기 (2026-07-17 신설)
 *  네이버 자동완성 + 구글 서제스트에서 실제 사용자 검색어를 수집해
 *  _workspace/intent/{slug}.json 생성 → satisfaction-judge의 채점 근거.
 *  사용: node scripts/intent-harvest.mjs 게보린 [아보다트 ...]
 *  주의: 공개 자동완성 엔드포인트만 사용. 요청 간 300ms 대기.
 */
import fs from "fs";
import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const kws = process.argv.slice(2);
if (!kws.length) { console.error("사용: node scripts/intent-harvest.mjs {키워드...}"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function naverAC(q) {
  try {
    const u = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const j = await r.json();
    return (j.items?.[0] || []).map((x) => x[0]).filter(Boolean);
  } catch { return []; }
}
async function googleSuggest(q) {
  try {
    const u = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(q)}`;
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const j = await r.json();
    return (j[1] || []).filter(Boolean);
  } catch { return []; }
}

for (const kw of kws) {
  const bag = new Set();
  // 본검색어 + 의도 시드(공백 확장)로 수집 폭 확대
  const seeds = [kw, kw + " 효과", kw + " 부작용", kw + " 가격", kw + " 복용"];
  for (const s of seeds) {
    for (const q of await naverAC(s)) bag.add(q.trim());
    await sleep(300);
    for (const q of await googleSuggest(s)) bag.add(q.trim());
    await sleep(300);
  }
  const related = [...bag].filter((q) => q.includes(kw)).slice(0, 40);
  const out = {
    keyword: kw,
    harvested: new Date().toISOString().slice(0, 10) + " naverAC+googleSuggest 실측",
    userQuestions: related, // 실제 검색어 그대로 — judge가 "검색자 질문"으로 사용
    competitorCovers: [],   // TODO: SERP 상위 유형 분석 (승산 판정) — 브라우저 필요
  };
  fs.mkdirSync(path.join(ROOT, "_workspace", "intent"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "_workspace", "intent", kw + ".json"), JSON.stringify(out, null, 1));
  console.log(`✓ ${kw}: 실측 검색어 ${related.length}개 → _workspace/intent/${kw}.json`);
  if (related.length < 5) console.log(`  ⚠️ ${kw} 수집량 부족(${related.length}) — 검색량 적은 키워드 가능성(저승산 후보)`);
}
