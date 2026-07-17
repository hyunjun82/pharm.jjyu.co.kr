#!/usr/bin/env node
/**
 * verify-crosssim.js — Layer 4: 글로벌 교차 유사도(도어웨이) 게이트
 *
 * 1만편 양산 시 최대 색인 리스크 = 페이지끼리 너무 비슷함(도어웨이) → 구글이 통째로 색인거부.
 * 기존 verify-doorway(글 내부)와 달리, "새 글 ↔ 발행된 모든 글"을 5-gram으로 대조한다.
 *
 * 사용법:
 *   node scripts/verify-crosssim.js --build [카테고리]      # gram-index 생성/갱신
 *   node scripts/verify-crosssim.js {slug} {draft.json}     # 드래프트를 기존과 대조
 *      exit 0 = 통과 / exit 1 = 중복위험(최근접 슬러그·유사도 출력)
 *
 * 성능: 5-gram 해시를 1/KEEP만 보관(다운샘플)해 인덱스 크기·비교속도 억제. 같은 카테고리 위주 비교.
 */
const fs = require("fs");
const path = require("path");

const INDEX = "_workspace/gram-index.json";
const PUBLIC = "public/data";
let TH = 0.30;
try { TH = JSON.parse(fs.readFileSync("scripts/quality-config.json", "utf8")).globalRules?.maxDoorwayOverlap5gram || 0.30; } catch {}
const N = 5, KEEP = 10; // 다운샘플 비율(1/10)

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function grams(text) {
  text = (text || "").replace(/\s+/g, "");
  const set = new Set();
  for (let i = 0; i + N <= text.length; i++) { const h = hash(text.slice(i, i + N)); if (h % KEEP === 0) set.add(h); }
  return set;
}
function bodyOfArticle(d) { return [d.heroDescription || "", ...(d.sections || []).map((s) => s.content || ""), ...((d.faq || []).map((f) => f.answer || ""))].join(" "); }
function jac(a, bArr) { const b = new Set(bArr); let inter = 0; for (const x of a) if (b.has(x)) inter++; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; }

const args = process.argv.slice(2);

if (args[0] === "--build") {
  const onlyCat = args[1] || null;
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
  const cats = fs.readdirSync(PUBLIC).filter((c) => fs.statSync(path.join(PUBLIC, c)).isDirectory());
  let n = 0;
  for (const cat of cats) {
    if (onlyCat && cat !== onlyCat) continue;
    for (const f of fs.readdirSync(path.join(PUBLIC, cat)).filter((f) => f.endsWith(".json"))) {
      const slug = f.replace(/\.json$/, "");
      try {
        const d = JSON.parse(fs.readFileSync(path.join(PUBLIC, cat, f), "utf8"));
        index[slug] = { cat, g: [...grams(bodyOfArticle(d))] };
        n++;
      } catch {}
    }
  }
  fs.writeFileSync(INDEX, JSON.stringify(index));
  console.log(`gram-index 생성: ${n}편 ${onlyCat ? "(" + onlyCat + ")" : "(전체)"} → ${INDEX}`);
  process.exit(0);
}

if (args[0] === "--add") {
  const s = args[1], df = args[2];
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
  const d = JSON.parse(fs.readFileSync(df, "utf8"));
  const cat = index[s] ? index[s].cat : (process.env.CAT || (d.category || "unknown"));
  index[s] = { cat, g: [...grams(bodyOfArticle(d))] };
  fs.writeFileSync(INDEX, JSON.stringify(index));
  console.log(`gram-index 추가: ${s}`);
  process.exit(0);
}

const [slug, draftFile] = args;
if (!slug || !draftFile) { console.log("usage: verify-crosssim.js --build [cat] | {slug} {draft.json}"); process.exit(2); }
if (!fs.existsSync(INDEX)) { console.log("CROSSSIM SKIP: gram-index 없음 (먼저 --build)"); process.exit(0); }

const index = JSON.parse(fs.readFileSync(INDEX, "utf8"));
const d = JSON.parse(fs.readFileSync(draftFile, "utf8"));
const mine = grams(bodyOfArticle(d));
const myCat = index[slug] ? index[slug].cat : null;

let worst = { slug: null, sim: 0 };
for (const [s, rec] of Object.entries(index)) {
  if (s === slug) continue;                       // 자기 자신 제외
  if (myCat && rec.cat !== myCat) continue;       // 같은 카테고리 위주(도어웨이는 동일군에서 발생)
  const sim = jac(mine, rec.g);
  if (sim > worst.sim) worst = { slug: s, sim };
}

if (worst.sim >= TH) {
  console.log(`CROSSSIM FAIL: 최근접 '${worst.slug}'와 5-gram 유사도 ${(worst.sim * 100).toFixed(0)}% ≥ 기준 ${(TH * 100).toFixed(0)}% — 차별화 재작성 필요`);
  process.exit(1);
}
console.log(`CROSSSIM PASS ✓ (최근접 ${worst.slug || "없음"} ${(worst.sim * 100).toFixed(0)}% < ${(TH * 100).toFixed(0)}%)`);
process.exit(0);
