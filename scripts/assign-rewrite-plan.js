#!/usr/bin/env node
/**
 * assign-rewrite-plan.js — 전 spoke 대상 일괄 재생산 계획 생성
 * 출력: _workspace/rewrite-plan.json
 *  - intent 배분 (A/B/C/D, 가격데이터 없으면 D 제외)
 *  - 실데이터 기반 unique 타이틀 (가격 선두, 제조사/함량/제형 차별)
 *  - AI 지식 0건: 모든 숫자는 data/products price, 제품명 표기에서만 추출
 */
const fs = require("fs");
const path = require("path");

// 1) products: slug → {name, price, unit}
const products = {};
for (const f of fs.readdirSync("data/products").filter((f) => f.endsWith(".ts"))) {
  const src = fs.readFileSync(path.join("data/products", f), "utf8");
  const blocks = src.split(/\{\s*\n\s*id:/).slice(1);
  for (const b of blocks) {
    const g = (re) => (b.match(re) || [])[1];
    const slug = g(/slug:\s*"([^"]+)"/);
    if (!slug) continue;
    products[slug] = {
      name: g(/name:\s*"([^"]+)"/) || slug,
      price: +(g(/price:\s*(\d+)/) || 0),
      unit: g(/unit:\s*"([^"]+)"/) || "",
    };
  }
}

// 2) source-data: slug → 제조사
const maker = {};
for (const f of fs.readdirSync("source-data").filter((f) => f.endsWith(".json"))) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join("source-data", f), "utf8"));
    const slug = j._slug || j.slug || f.replace(".json", "");
    const m = j.ENTRPS || j.entpName || "";
    if (m) maker[slug] = m.replace(/\(주\)|주식회사|\(유\)/g, "").trim();
  } catch (e) {}
}

// 3) spokes 수집
const spokes = [];
for (const f of fs.readdirSync("data/articles")) {
  if (!/\.ts$/.test(f) || /^(index|build-all)/.test(f)) continue;
  const src = fs.readFileSync(path.join("data/articles", f), "utf8");
  const re = /slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"([^"]+)",/g;
  let m;
  while ((m = re.exec(src))) {
    const tail = src.slice(m.index, m.index + 2500);
    const title = (tail.match(/title:\s*"([^"]+)"/) || [])[1] || "";
    const v2 = /searchIntent:\s*"[A-F]"/.test(tail);
    spokes.push({ file: f, slug: m[1], cat: m[2], oldTitle: title, v2 });
  }
}

// 4) 제품명에서 함량/제형/수량 추출 (표기 그대로, AI 지식 아님)
function extractAttrs(name, slug) {
  const dose = (name.match(/(\d+(?:\.\d+)?(?:mg|g|%|억|ml|mL|IU|㎍|mcg)\b[^ ]*)/) || [])[1] || "";
  const count = (name.match(/(\d+(?:정|캡슐|포|매|개입|환|병|ml|mL))\s*$/) || [])[1] || "";
  let form = "";
  const formMap = { 정: "정제", 액: "외용액", 겔: "겔", 폼: "폼", 캡슐: "캡슐", 연질캡슐: "연질캡슐", 시럽: "시럽", 크림: "크림", 연고: "연고", 패치: "패치", 과립: "과립", 포: "분말스틱" };
  for (const k of ["연질캡슐", "캡슐", "크림", "연고", "시럽", "과립", "패치", "겔", "폼", "액", "정", "포"]) {
    if (slug.includes(k) || name.includes(k)) { form = formMap[k]; break; }
  }
  return { dose, count, form };
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const fmt = (n) => n.toLocaleString("ko-KR");

// 5) intent 배분 + 타이틀 생성
const RATIO = { A: 0.3, B: 0.25, C: 0.2, D: 0.25 }; // E/F는 풀 리라이트 단계에서만
const counters = {};
const usedTitles = new Set();
const plan = [];

for (const s of spokes) {
  if (s.v2) { plan.push({ ...s, action: "keep(v2완료)" }); continue; }
  const p = products[s.slug] || { name: s.slug, price: 0, unit: "" };
  const mk = maker[s.slug] || "";
  const { dose, count, form } = extractAttrs(p.name, s.slug);
  const c = (counters[s.cat] = counters[s.cat] || { A: 0, B: 0, C: 0, D: 0, n: 0 });
  // D는 가격 있을 때만
  const order = ["D", "A", "B", "C"].filter((i) => i !== "D" || p.price > 0);
  let intent = order[0];
  for (const i of order) if (c[i] / Math.max(c.n, 1) < RATIO[i]) { intent = i; break; }
  c[intent]++; c.n++;

  const P = s.slug;
  const price = p.price > 0 ? `${fmt(p.price)}원` : "";
  const mkShort = mk.length > 7 ? "" : mk;
  const usage = ["외용액", "겔", "폼", "크림", "연고", "패치"].includes(form) ? "사용법" : "복용법";
  const h = hash(P);
  const pick = (arr) => arr[h % arr.length];

  let variants;
  if (intent === "D") {
    variants = [
      `${P} 가격 ${price}~ 약국 최저가 | 효능 부작용`,
      `${P} 최저가 ${price}~ | ${[mkShort, dose].filter(Boolean).join(" ") || "약국"} 가격 비교`,
      `${P} 가격 ${price}~ | ${count || p.unit || "약국별"} 최저가·효능`,
      `${P} 약국 가격 ${price}~ | 효과 ${usage} 부작용`,
    ];
  } else if (intent === "A") {
    variants = [
      `${P} 효과·가격 | ${[mkShort, dose].filter(Boolean).join(" ") || "성분"} ${usage} 부작용`,
      `${P} 효능과 가격${price ? ` ${price}~` : ""} | ${usage}·부작용`,
      `${P} 효과 언제부터? ${usage}·부작용·가격${price ? ` ${price}~` : ""}`,
      `${P} 성분 효능 | 가격${price ? ` ${price}~` : ""}·부작용 정리`,
    ];
  } else if (intent === "B") {
    variants = [
      `${P} 부작용과 중단 기준 | 효능·가격${price ? ` ${price}~` : ""}`,
      `${P} 부작용 주의사항 | ${[mkShort, dose].filter(Boolean).join(" ") || "성분"} 효과·가격`,
      `${P} 부작용 신호 총정리 | ${usage}·가격${price ? ` ${price}~` : ""}`,
    ];
  } else {
    variants = [
      `${P} ${usage} 총정리 | 효과·부작용·가격${price ? ` ${price}~` : ""}`,
      `${P} ${usage}과 가격${price ? ` ${price}~` : ""} | ${[mkShort, dose].filter(Boolean).join(" ") || "성분"} 효과`,
      `${P} 올바른 ${usage} | 부작용·약국 가격${price ? ` ${price}~` : ""}`,
    ];
  }
  let title = pick(variants).replace(/\s+/g, " ").replace(/\|\s*\|/g, "|").trim();
  let k = 1;
  while (usedTitles.has(title)) { title = pick(variants.slice().reverse()) + (k > 1 ? ` (${count || k})` : ""); k++; }
  usedTitles.add(title);
  plan.push({ ...s, intent, newTitle: title, price: p.price, maker: mk, dose, form, action: "retitle" });
}

fs.writeFileSync("_workspace/rewrite-plan.json", JSON.stringify(plan, null, 1));
const stats = { 총: plan.length, retitle: plan.filter((x) => x.action === "retitle").length, 가격포함: plan.filter((x) => x.newTitle && /가격|최저가/.test(x.newTitle)).length, 실제가격노출: plan.filter((x) => x.newTitle && /원~/.test(x.newTitle)).length };
console.log(JSON.stringify(stats));
console.log("\n샘플 15개:");
for (const x of plan.filter((x) => x.action === "retitle").filter((_, i) => i % 230 === 0).slice(0, 15)) console.log(`[${x.cat}/${x.intent}] ${x.newTitle}`);
