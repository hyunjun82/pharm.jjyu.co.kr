#!/usr/bin/env node
/** build-rewrite-queue.js
 * 1) 유산균·탈모 본문에서 10개+ 글이 공유하는 보일러플레이트 문장 추출
 *    → _workspace/boilerplate-{cat}.json (writer 금지문장 목록)
 * 2) 글별 보일러플레이트 비중 측정 → 우선순위 리라이트 큐
 *    → _workspace/rewrite-queue.json
 */
const fs = require("fs");
const TARGET = ["유산균", "탈모"];

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
const queue = [];

for (const cat of TARGET) {
  const arts = loadBodies(cat).filter((a) => a.text.length > 300);
  // 문장 단위 (슬러그→P 치환해 제품명만 다른 문장도 잡음)
  const sentCount = {};
  for (const a of arts) {
    const sents = new Set(
      a.text.replaceAll(a.slug, "P").replace(/\\n/g, " ").split(/(?<=요\.|다\.|요\?)/)
        .map((s) => s.trim()).filter((s) => s.length > 30)
    );
    for (const s of sents) sentCount[s] = (sentCount[s] || 0) + 1;
  }
  const boiler = Object.entries(sentCount).filter(([, c]) => c >= 10).sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(`_workspace/boilerplate-${cat}.json`,
    JSON.stringify(boiler.map(([s, c]) => ({ count: c, sentence: s })), null, 1));
  const boilerSet = new Set(boiler.map(([s]) => s));
  for (const a of arts) {
    const sents = a.text.replaceAll(a.slug, "P").replace(/\\n/g, " ").split(/(?<=요\.|다\.|요\?)/)
      .map((s) => s.trim()).filter((s) => s.length > 30);
    const hit = sents.filter((s) => boilerSet.has(s)).length;
    const ratio = sents.length ? hit / sents.length : 0;
    const p = planBySlug[a.slug] || {};
    queue.push({
      cat, slug: a.slug, file: a.file,
      boilerplateRatio: +ratio.toFixed(2),
      hasPrice: (p.price || 0) > 0,
      intent: p.intent || null,
      chars: a.text.length,
    });
  }
  console.log(`[${cat}] 글 ${arts.length}개 | 보일러플레이트 문장(10개+ 글 공유): ${boiler.length}개 | 최다 공유: ${boiler[0] ? boiler[0][1] + "개 글" : "-"}`);
}
// 우선순위: 중복비중 높음 > 가격데이터 있음 > 글자수 적음
queue.sort((a, b) => (b.boilerplateRatio - a.boilerplateRatio) || (b.hasPrice - a.hasPrice));
fs.writeFileSync("_workspace/rewrite-queue.json", JSON.stringify(queue, null, 1));
const urgent = queue.filter((q) => q.boilerplateRatio >= 0.5);
console.log(`\n리라이트 큐 ${queue.length}건 저장. 보일러플레이트 50%+ (긴급): ${urgent.length}건`);
console.log("긴급 TOP10:", urgent.slice(0, 10).map((q) => `${q.cat}/${q.slug}(${(q.boilerplateRatio * 100) | 0}%)`).join(", "));
