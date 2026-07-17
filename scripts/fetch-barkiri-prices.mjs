#!/usr/bin/env node
/** fetch-barkiri-prices.mjs — 발키리 실거래 가격범위 수집기 (2026-07-17 신설)
 *  barkiri.com 제품 페이지의 JSON-LD AggregateOffer에서 최저가·최고가·인증약국수 수집.
 *  사용: node scripts/fetch-barkiri-prices.mjs p223,p1559       # 지정 수집
 *        node scripts/fetch-barkiri-prices.mjs --all            # 전체 barkiryProductId
 *        node scripts/fetch-barkiri-prices.mjs --all --limit 50 # 상한
 *  출력: data/barkiri-prices.json (기존 파일에 병합, fetchedAt 기록)
 *  주의: 요청 간 400ms 대기 (발키리 서버 예의). 실패 pid는 error로 기록하고 계속.
 */
import fs from "fs";
import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "data", "barkiri-prices.json");

const args = process.argv.slice(2);
let pids = [];
if (args[0] === "--all") {
  const dir = path.join(ROOT, "data", "products");
  const set = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/barkiryProductId:\s*"(p\d+)"/g)) set.add(m[1]);
  }
  pids = [...set];
  const li = args.indexOf("--limit");
  if (li > -1) pids = pids.slice(0, +args[li + 1]);
} else {
  pids = (args[0] || "").split(",").map((x) => x.trim()).filter(Boolean);
}
if (!pids.length) { console.error("pid 없음. 사용법 참조."); process.exit(1); }

let db = {};
try { db = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fail = 0;
for (const pid of pids) {
  try {
    const res = await fetch(`https://barkiri.com/products/${pid}`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    let found = null;
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
      try {
        const d = JSON.parse(m[1]);
        if (d["@type"] === "Product" && d.offers) {
          const o = d.offers;
          // AggregateOffer면 범위+약국수, 단일 Offer면 price 폴백(약국 1곳 취급 — 범위 표기 대신 기준가 취급)
          const low = o.lowPrice ?? o.price, high = o.highPrice ?? o.price, cnt = o.offerCount ?? (o.price ? 1 : 0);
          found = { name: d.name, lowPrice: low, highPrice: high, storeCount: cnt, aggregate: o["@type"] === "AggregateOffer", fetchedAt: new Date().toISOString().slice(0, 10) };
          break;
        }
      } catch {}
    }
    if (!found) throw new Error("JSON-LD Product 없음");
    db[pid] = found; ok++;
    console.log(`✓ ${pid} ${found.name?.slice(0,20)} ${found.lowPrice}~${found.highPrice}원 약국${found.storeCount}`);
  } catch (e) {
    db[pid] = { error: String(e.message), fetchedAt: new Date().toISOString().slice(0, 10) }; fail++;
    console.log(`✗ ${pid} ${e.message}`);
  }
  await sleep(400);
}
fs.writeFileSync(OUT, JSON.stringify(db, null, 1));
console.log(`\n저장: ${OUT} (성공 ${ok} / 실패 ${fail} / 누적 ${Object.keys(db).length})`);
