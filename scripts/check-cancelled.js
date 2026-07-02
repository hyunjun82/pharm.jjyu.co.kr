#!/usr/bin/env node
/**
 * 허가취소·변경 감지기 (2026-07-02) — "판매중지 약 추천" 사고 예방
 * 전 소스의 itemSeq를 허가정보 API와 대조: CANCEL_DATE 있으면 경보, CHANGE_DATE가 fetchedAt 이후면 재수집 권고
 * 사용: node scripts/check-cancelled.js [--limit N]   (전수 ~2,000건 × 0.15s ≈ 5분, resume 안전)
 */
const fs = require("fs"); const path = require("path"); const https = require("https");
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.DRUG_PERMIT_API_KEY;
const LOG = path.join(ROOT, "_workspace", "cancel-check-log.json");
const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? +args[args.indexOf("--limit") + 1] : Infinity;
const get = (url) => new Promise((res, rej) => https.get(url, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }).on("error", rej));
(async () => {
  const files = fs.readdirSync(path.join(ROOT, "source-data")).filter((f) => f.endsWith(".json") && !["source-map.json","schema.json"].includes(f));
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};
  const today = new Date().toISOString().slice(0, 10);
  let n = 0, cancelled = [], changed = [];
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    if (log[slug] && log[slug].at === today) continue;
    let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, "source-data", f), "utf8")); } catch { continue; }
    if (!d.itemSeq) continue;
    if (n >= LIMIT) break;
    const url = `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=1&pageNo=1&item_seq=${encodeURIComponent(d.itemSeq)}`;
    let it = null;
    try { it = (((JSON.parse(await get(url)).body || {}).items) || [])[0] || null; } catch {}
    const cancel = it && (it.CANCEL_DATE || "").trim();
    const change = it && String(it.CHANGE_DATE || "").slice(0, 10).replace(/-/g, "");
    const fetched = String(d.fetchedAt || "").replace(/-/g, "");
    const entry = { at: today };
    if (!it) { entry.status = "NOT_FOUND(허가DB에 없음 — 확인 필요)"; cancelled.push(slug + " (조회불가)"); }
    else if (cancel) { entry.status = "CANCELLED " + cancel; cancelled.push(`${slug} — 허가취소 ${cancel} (${it.CANCEL_NAME || ""})`); }
    else if (change && fetched && change > fetched) { entry.status = "CHANGED " + change; changed.push(`${slug} — 허가변경 ${change} > 수집 ${fetched}`); }
    else entry.status = "OK";
    log[slug] = entry; n++;
    if (n % 50 === 0) { console.log(`  ${n}건 (경보 ${cancelled.length} / 변경 ${changed.length})...`); fs.writeFileSync(LOG, JSON.stringify(log)); }
    await new Promise((r) => setTimeout(r, 130));
  }
  fs.writeFileSync(LOG, JSON.stringify(log));
  const rep = [`# 허가취소·변경 감지 (${today})`, "", `검사 ${n}건`, "", `## 🚨 취소/조회불가 (${cancelled.length}) — 페이지 내리거나 재확인`, ...cancelled.map((x) => "- " + x), "", `## ⚠️ 허가변경 (${changed.length}) — 소스 재수집 권고`, ...changed.map((x) => "- " + x)].join("\n");
  fs.writeFileSync(path.join(ROOT, "reports", `허가취소감지-${today}.md`), rep);
  console.log(`\n══ 검사 ${n} / 취소·조회불가 ${cancelled.length} / 변경 ${changed.length} → reports/허가취소감지-${today}.md`);
})();
