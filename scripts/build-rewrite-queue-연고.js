#!/usr/bin/env node
/** build-rewrite-queue-연고.js
 * 연고 카테고리 전용 큐 빌더. build-rewrite-queue.js와 동일 로직이되
 * rewrite-queue.json을 덮어쓰지 않고 "연고 엔트리만 교체"(탈모/유산균 보존, 멱등).
 * 의도: 탈모는 Cowork가 동시 진행 중 → 공유 큐 파일을 통째로 갈아엎으면 안 됨.
 */
const fs = require("fs");
const CAT = "연고";

function loadBodies(cat) {
  const out = [];
  for (const f of fs.readdirSync("data/articles").filter((f) => f.startsWith(cat) && f.endsWith(".ts"))) {
    const src = fs.readFileSync("data/articles/" + f, "utf8");
    const idx = [];
    let m; const re = /slug:\s*"([^"]+)",\s*\n\s*categorySlug:/g;
    while ((m = re.exec(src))) idx.push({ slug: m[1], i: m.index });
    for (let k = 0; k < idx.length; k++) {
      const seg = src.slice(idx[k].i, idx[k + 1] ? idx[k + 1].i : src.length);
      const conts = [...seg.matchAll(/(?:content|answer):\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
      out.push({ slug: idx[k].slug, file: f, text: conts.join(" ") });
    }
  }
  return out;
}

const plan = JSON.parse(fs.readFileSync("_workspace/rewrite-plan.json", "utf8"));
const planBySlug = {}; plan.forEach((p) => (planBySlug[p.slug] = p));
const imap = JSON.parse(fs.readFileSync("_workspace/integrity-map.json", "utf8"));
const statusBySlug = {}; imap.forEach((x) => (statusBySlug[x.slug] = x.status));

const arts = loadBodies(CAT).filter((a) => a.text.length > 300);
const sentCount = {};
for (const a of arts) {
  const sents = new Set(
    a.text.replaceAll(a.slug, "P").replace(/\\n/g, " ").split(/(?<=요\.|다\.|요\?)/)
      .map((s) => s.trim()).filter((s) => s.length > 30)
  );
  for (const s of sents) sentCount[s] = (sentCount[s] || 0) + 1;
}
const boiler = Object.entries(sentCount).filter(([, c]) => c >= 10).sort((a, b) => b[1] - a[1]);
fs.writeFileSync(`_workspace/boilerplate-${CAT}.json`,
  JSON.stringify(boiler.map(([s, c]) => ({ count: c, sentence: s })), null, 1));
const boilerSet = new Set(boiler.map(([s]) => s));

const newEntries = [];
for (const a of arts) {
  const sents = a.text.replaceAll(a.slug, "P").replace(/\\n/g, " ").split(/(?<=요\.|다\.|요\?)/)
    .map((s) => s.trim()).filter((s) => s.length > 30);
  const hit = sents.filter((s) => boilerSet.has(s)).length;
  const ratio = sents.length ? hit / sents.length : 0;
  const p = planBySlug[a.slug] || {};
  newEntries.push({
    cat: CAT, slug: a.slug, file: a.file,
    boilerplateRatio: +ratio.toFixed(2),
    hasPrice: (p.price || 0) > 0,
    intent: p.intent || null,
    chars: a.text.length,
  });
}
// 우선순위: 중복비중 높음 > 가격데이터 있음
newEntries.sort((a, b) => (b.boilerplateRatio - a.boilerplateRatio) || (b.hasPrice - a.hasPrice));

// 기존 큐에서 연고 제거 후 연고 엔트리 추가 (탈모/유산균 보존, 멱등)
const QF = "_workspace/rewrite-queue.json";
const prev = JSON.parse(fs.readFileSync(QF, "utf8"));
const kept = prev.filter((x) => x.cat !== CAT);
const merged = [...kept, ...newEntries];
fs.writeFileSync(QF, JSON.stringify(merged, null, 1));

const st = {}; newEntries.forEach((e) => { const s = statusBySlug[e.slug] || "UNKNOWN"; st[s] = (st[s] || 0) + 1; });
const verified = newEntries.filter((e) => statusBySlug[e.slug] === "VERIFIED").length;
console.log(`[${CAT}] 큐 엔트리 ${newEntries.length}건 생성 | 보일러플레이트 문장: ${boiler.length}개`);
console.log(`상태분포:`, st, `→ auto-batch가 실제 처리할 VERIFIED: ${verified}건`);
console.log(`큐 병합: 보존 ${kept.length}건(탈모/유산균) + 연고 ${newEntries.length}건 = 총 ${merged.length}건`);
console.log(`긴급(보일러 50%+) TOP10:`, newEntries.filter((q) => q.boilerplateRatio >= 0.5).slice(0, 10).map((q) => `${q.slug}(${(q.boilerplateRatio * 100) | 0}%)`).join(", ") || "없음");
