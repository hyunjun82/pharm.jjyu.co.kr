#!/usr/bin/env node
/** 2단계: 글별 작성 브리프 생성 — 검증된 사실만 모아 writer에게 공급
 *  사용: node scripts/build-write-brief.js {slug}
 *  출력: _workspace/briefs/{slug}.json
 *  내용: 무결성 상태, 소스 원문 필드, 가격+동일성분 가격포지션, 의도·앵커,
 *        타이틀 패턴 가이드(승인본), 금지문장, 숫자 화이트리스트
 */
const fs = require("fs");
const slug = process.argv[2];
if (!slug) { console.error("slug 필요"); process.exit(1); }
const imap = JSON.parse(fs.readFileSync("_workspace/integrity-map.json", "utf8"));
const me = imap.find((x) => x.slug === slug);
if (!me) { console.error("무결성 맵에 없음"); process.exit(1); }
if (me.status === "NEEDS_REFETCH") { console.error("작성 차단: 소스 재수집 필요 →", me.issues.join("; ")); process.exit(2); }
let source = null;
for (const f of fs.readdirSync("source-data")) {
  if (!f.endsWith(".json")) continue;
  try { const j = JSON.parse(fs.readFileSync("source-data/" + f, "utf8")); if ((j._slug || j.slug) === slug) { source = j; break; } } catch (e) {}
}
// 가격 포지션 (동일성분군: products desc의 성분+함량 문자열로 근사 매칭)
const cat = me.cat;
const psrc = fs.readFileSync(`data/products/${cat}.ts`, "utf8");
const all = [];
for (const b of psrc.split(/\{\s*\n\s*id:/).slice(1)) {
  const g = (re) => (b.match(re) || [])[1];
  const s2 = g(/slug: "([^"]+)"/); if (!s2) continue;
  all.push({ slug: s2, name: g(/name: "([^"]+)"/) || "", desc: g(/description: "([^"]+)"/) || "", price: +(g(/price: (\d+)/) || 0), unit: g(/unit: "([^"]+)"/) || "" });
}
const mine = all.find((x) => x.slug === slug) || {};
const ing = (mine.desc.match(/(피나스테리드|두타스테리드|미녹시딜|세티리진|로라타딘|[가-힣]+) ?([\d.]+(?:mg|%))/) || []);
let group = [];
if (ing[1]) group = all.filter((x) => x.desc.includes(ing[1]) && x.desc.includes(ing[2]) && x.price > 0)
  .map((x) => { const cnt = +((x.unit.match(/(\d+)정/) || x.name.match(/(\d+)정/) || [])[1] || 0); return { ...x, per: cnt ? Math.round(x.price / cnt) : null }; })
  .filter((x) => x.per).sort((a, b) => a.per - b.per);
const myPos = group.findIndex((x) => x.slug === slug);
// 금지문장
let forbidden = [];
const bf = `_workspace/boilerplate-${cat}.json`;
if (fs.existsSync(bf)) forbidden = JSON.parse(fs.readFileSync(bf, "utf8")).slice(0, 80).map((x) => x.sentence);
// 숫자 화이트리스트: 소스+가격에서 추출
const numPool = new Set();
const harvest = (t) => { if (t) for (const n of String(t).match(/\d+(?:[.,]\d+)?\s*(?:mg|%|ml|mL|개월|주|시간|일|회|세|정|원|℃|CFU)?/g) || []) numPool.add(n.trim()); };
if (source) Object.values(source).forEach(harvest);
harvest(mine.price + "원"); if (mine.unit) harvest(mine.unit);
group.slice(0, 5).forEach((x) => { harvest(x.per + "원"); harvest(x.price + "원"); });
const brief = {
  slug, cat, status: me.status, issues: me.issues,
  correctionNotes: me.issues.filter((i) => /적응증|불일치/.test(i)),
  source, product: mine,
  pricePosition: group.length ? { groupIngredient: ing[1] + " " + ing[2], groupSize: group.length, rank: myPos + 1, myPerTablet: group[myPos] && group[myPos].per, range: [group[0].per, group[group.length - 1].per], cheapest3: group.slice(0, 3), original: group.filter((x) => /프로페시아|아보다트|로게인|프로스카/.test(x.slug)) } : null,
  titleRules: {
    필수: "제품명 선두 + '가격' 또는 '최저가' 단어 포함(숫자 금지) + 키워드 3~5개 자연 연결 + 30~40자 + 파이프 최대 1회",
    패턴: ["정의형: {P}이란? {K1}부터 {K2}, 가격까지 총정리", "PAA형: {P} {K1} 언제부터/어떻게? {K2}과 가격 정리", "파이프형: {P} {K1}ㅣ{K2}·{K3}·가격", "후킹형: {P} {상황} 전 확인할 {K1}과 {K2}, 가격", "가격형: {P} 가격과 {산출가능한 비용항목}, {K1}·{K2}까지", "대안형: {P} 가격 부담된다면? 같은 성분 제네릭과 최저가"],
    금지: "약속 못 지키는 단어(비교표 없는데 '비교'), 가격 숫자, 어그로",
  },
  bodyRules: {
    구조: "질문형 H2 5~7개, 타이틀 약속 키워드는 반드시 H2로 실존",
    문체: "~해요체(메타만 문어체), 100자당 숫자 2.0+, 1000자당 출처인용 1+",
    가격섹션: "가격 포지션(동일성분 내 순위·범위) + 발키리/네이버 버튼. 실거래가 미확인 시 '기준가' 명시",
    교정: me.issues.some((i) => /전립선/.test(i)) ? "전문의약품·전립선 적응증 명시, 탈모 4등분 복용법 금지, 탈모 목적은 1mg 제품 안내로 연결" : null,
  },
  forbiddenSentences: forbidden,
  numericWhitelist: [...numPool].slice(0, 200),
};
fs.mkdirSync("_workspace/briefs", { recursive: true });
fs.writeFileSync(`_workspace/briefs/${slug}.json`, JSON.stringify(brief, null, 1));
console.log(`브리프 생성: _workspace/briefs/${slug}.json | 상태 ${me.status} | 가격포지션 ${brief.pricePosition ? brief.pricePosition.rank + "/" + brief.pricePosition.groupSize : "없음"} | 금지문장 ${forbidden.length}`);
