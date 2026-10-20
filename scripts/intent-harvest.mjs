#!/usr/bin/env node
/** intent-harvest.mjs — 네이버 자동완성(연관검색어) 수집기 (2026-10-20 개정: 네이버 전용)
 *  사용: node scripts/intent-harvest.mjs "{키워드}" [--slug {슬러그}]
 *  출력: _workspace/intent/{슬러그 또는 키워드}.json
 *    userQuestions = 키워드 그대로 쳤을 때 네이버 자동완성 1단계 (검색창 화면과 같은 목록) → check-article R10 의 타이틀 근거
 *    expanded      = "{키워드} 가격/효과/…"로 넓혀 친 자동완성 (참고용, 타이틀 근거 아님)
 *  종료코드: 1단계 결과가 0개면 1 (네트워크 차단·검색량 없음 → 타이틀을 만들 근거 없음)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."); // Windows: new URL().pathname 은 "/C:/..." 라 경로가 C:\C:\ 로 깨졌음
const argv = process.argv.slice(2);
const si = argv.indexOf("--slug");
const OUT_SLUG = si > -1 ? argv[si + 1] : null;
const kw = argv.filter((a, i) => a !== "--slug" && i !== si + 1).join(" ").trim();
if (!kw) { console.error('사용: node scripts/intent-harvest.mjs "{키워드}" [--slug {슬러그}]'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function naverAC(q) {
  const u = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const j = await r.json();
    return (j.items?.[0] || []).map((x) => String(x[0]).trim()).filter(Boolean);
  } catch (e) { console.error(`  네이버 자동완성 요청 실패(${q}): ${e.cause?.code || e.message}`); return null; }
}

const top = await naverAC(kw);
const expanded = new Set();
if (top && top.length) {
  for (const seed of ["가격", "효과", "부작용", "사용법", "복용법"]) {
    await sleep(300);
    for (const q of (await naverAC(`${kw} ${seed}`)) || []) if (!top.includes(q)) expanded.add(q);
  }
}
const out = {
  keyword: kw,
  harvested: new Date().toISOString().slice(0, 10) + " 네이버 자동완성 (ac.search.naver.com)",
  userQuestions: top || [],
  expanded: [...expanded],
};
fs.mkdirSync(path.join(ROOT, "_workspace", "intent"), { recursive: true });
const file = path.join(ROOT, "_workspace", "intent", (OUT_SLUG || kw) + ".json");
if (!top || !top.length) { console.error(`✗ ${kw}: 네이버 자동완성 0개 — 저장 안 함 (${top === null ? "접속 실패" : "검색량 없음"})`); process.exit(1); }
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`✓ ${kw}: 자동완성 ${top.length}개 (+확장 ${expanded.size}개) → ${path.relative(ROOT, file)}`);
console.log("  " + top.join(" / "));
