#!/usr/bin/env node
/** 3단계: 작성 결과 품질 게이트 — 통과 못 하면 반려
 *  사용: node scripts/validate-article.js {slug} {draft.json}
 *  draft.json: { title, metaDescription, heroDescription, sections:[{title,content}], faq:[{question,answer}] }
 */
const fs = require("fs");
const [slug, draftFile] = process.argv.slice(2);
const brief = JSON.parse(fs.readFileSync(`_workspace/briefs/${slug}.json`, "utf8"));
const d = JSON.parse(fs.readFileSync(draftFile, "utf8"));
const fails = [];
const body = [d.heroDescription, ...d.sections.map((s) => s.content), ...d.faq.map((f) => f.answer)].join(" ");
// T1 타이틀
if (!d.title.startsWith(slug)) fails.push("T1: 제품명이 선두 아님");
if (!/가격|최저가/.test(d.title)) fails.push("T2: 가격/최저가 단어 없음");
if (/\d{1,3}(,\d{3})*\s*원/.test(d.title)) fails.push("T3: 타이틀에 가격 숫자");
if ((d.title.match(/[|ㅣ]/g) || []).length > 1) fails.push("T4: 파이프 2회+");
if (d.title.length < 20 || d.title.length > 45) fails.push("T5: 길이 " + d.title.length);
// T6 타이틀 약속 ↔ H2
const promises = ["효능", "효과", "부작용", "복용법", "사용법", "보관"].filter((k) => d.title.includes(k));
for (const k of promises) if (!d.sections.some((s) => s.title.includes(k) || (k === "효능" && s.title.includes("효과")) || (k === "효과" && s.title.includes("효능")))) fails.push("T6: 타이틀 약속 '" + k + "' H2 없음");
if (!d.sections.some((s) => /가격/.test(s.title))) fails.push("T6: 가격 H2 없음");
// B1 숫자 화이트리스트
const wl = new Set(brief.numericWhitelist.map((n) => n.replace(/[^\d.]/g, "")));
(brief.verifiedExternalFacts||[]).forEach(f=>(f.nums||[]).forEach(n=>wl.add(String(n))));
const nums = body.match(/\d+(?:[.,]\d+)?/g) || [];
const derived = new Set(); // 단순 산수 허용: 가격/수량, ×30, ×12, 만원 환산
if (brief.product && brief.product.price) { const p = brief.product.price; const c = +((brief.product.unit || "").match(/(\d+)/) || [0, 0])[1]; if (c) { derived.add(String(Math.round(p / c))); derived.add(String(Math.round((p / c) * 30))); derived.add(String(Math.round((p / c) * 365))); } }
if (brief.pricePosition) { brief.pricePosition.cheapest3.concat(brief.pricePosition.original || []).forEach((x) => { derived.add(String(x.per)); derived.add(String(x.per * 30)); derived.add(String(x.price)); }); derived.add(String(brief.pricePosition.groupSize)); derived.add(String(brief.pricePosition.rank)); brief.pricePosition.range.forEach((r) => { derived.add(String(r)); derived.add(String(r * 30)); }); }
[1, 2, 3, 100].forEach((n) => derived.add(String(n)));
const bad = [...new Set(nums.map((n) => n.replace(/,/g, "")))].filter((n) => !wl.has(n) && !derived.has(n) && !derived.has(String(Math.round(+n / 10) * 10)) && +n > 3);
if (bad.length) fails.push("B1: 출처 없는 숫자 → " + bad.slice(0, 10).join(", "));
// B2 금지문장(보일러플레이트)
const slugless = body.replaceAll(slug, "P");
let hit = 0; for (const s of brief.forbiddenSentences) if (slugless.includes(s)) hit++;
if (hit) fails.push("B2: 보일러플레이트 " + hit + "문장");
// B3 문체
if (/[가-힣]+(합니다|입니다)[.\s]/.test(body)) fails.push("B3: ~합니다체 발견(본문)");
// B4 가격 단어 밀도
if ((body.match(/원/g) || []).length < 3) fails.push("B4: '원' 3회 미만");
// B5 출처 인용 밀도
const cite = (body.match(/식약처|허가사항|품목|식품안전나라|신고번호/g) || []).length;
if (cite < Math.floor(body.length / 1000)) fails.push("B5: 출처 인용 부족 (" + cite + "/" + Math.floor(body.length / 1000) + ")");
// B5b 외부 임상사실 출처 표기
if((brief.verifiedExternalFacts||[]).length && /DHT|환원효소|메타분석|FDA/.test(body) && !/임상|문헌|학회|FDA|연구/.test(body)) fails.push("B5b: 외부 임상사실에 출처 표기 없음");
// B6 글자수
if (body.length < 1800 || body.length > 4000) fails.push("B6: 글자수 " + body.length);
// B7 교정 의무
if (brief.bodyRules.교정 && !/전립선|전립샘/.test(body)) fails.push("B7: 전립선 적응증 교정 미반영");
if (brief.bodyRules.교정 && /4등분|쪼개/.test(body)) fails.push("B7: 허가범위 밖 분할복용 안내 금지");
// B8 찍어내기 서론 금지
const introBan=["핵심부터 말하면","결론부터 말하면","정리했어요.","정리했습니다."];
for(const ph of introBan){ if((d.heroDescription||"").includes(ph)) fails.push("B8: 서론 금지문구 '"+ph+"' (찍어내기 패턴)"); }
console.log(fails.length ? "FAIL\n- " + fails.join("\n- ") : "PASS ✓ (타이틀·숫자·문체·중복·인용 전 항목 통과)");
process.exit(fails.length ? 1 : 0);
