#!/usr/bin/env node
/** fetch-drug.mjs — 식약처 원문(e약은요 API) 한 제품 자동 수집 (2026-10-20)
 *  사용: node scripts/fetch-drug.mjs "{제품명}" --slug {슬러그}
 *  필요: 환경변수 DRUG_PERMIT_API_KEY (공공데이터포털 키), apis.data.go.kr 접속
 *  출력: source-data/{슬러그}.json  (기존 source-data 형식과 같은 필드)
 *  제품명이 정확히 하나로 맞지 않으면 저장하지 않고 후보를 보여준 뒤 종료코드 1 (다른 제품 원문이 붙는 사고 방지)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const si = argv.indexOf("--slug");
const slug = si > -1 ? argv[si + 1] : null;
const name = argv.filter((a, i) => a !== "--slug" && i !== si + 1).join(" ").trim();
if (!name || !slug) { console.error('사용: node scripts/fetch-drug.mjs "{제품명}" --slug {슬러그}'); process.exit(2); }
const KEY = process.env.DRUG_PERMIT_API_KEY;
if (!KEY) { console.error("✗ DRUG_PERMIT_API_KEY 없음 — 환경 변수(클라우드: 환경 설정, PC: .env.local)에 공공데이터포털 키 필요"); process.exit(1); }

const url = `https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=100&itemName=${encodeURIComponent(name)}`;
let items;
try {
  const r = await fetch(url);
  items = ((await r.json()).body || {}).items || [];
} catch (e) { console.error(`✗ 식약처 API 접속 실패: ${e.cause?.code || e.message}`); process.exit(1); }

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/\(.*?\)/g, "").toLowerCase();
const exact = items.filter((x) => norm(x.itemName) === norm(name) || norm(x.itemName) === norm(slug));
if (exact.length !== 1) {
  console.error(`✗ "${name}" 정확히 일치 ${exact.length}건 — 저장 안 함. 후보:`);
  for (const x of items.slice(0, 10)) console.error(`   - ${x.itemName} (${x.entpName}, ${x.itemSeq})`);
  console.error(`  → 원하는 제품명을 그대로 넣어 다시: node scripts/fetch-drug.mjs "{후보 제품명}" --slug ${slug}`);
  process.exit(1);
}
const h = exact[0];
const out = {
  sourceType: "api", sourceOrigin: "e약은요 API (apis.data.go.kr)", fetchedAt: new Date().toISOString().slice(0, 10),
  itemName: h.itemName, entpName: h.entpName, itemSeq: h.itemSeq,
  efcyQesitm: (h.efcyQesitm || "").trim(), useMethodQesitm: (h.useMethodQesitm || "").trim(),
  atpnWarnQesitm: (h.atpnWarnQesitm || "").trim(), atpnQesitm: (h.atpnQesitm || "").trim(),
  intrcQesitm: (h.intrcQesitm || "").trim(), seQesitm: (h.seQesitm || "").trim(),
  depositMethodQesitm: (h.depositMethodQesitm || "").trim(), itemImage: h.itemImage || "", updateDe: h.updateDe || "",
};
fs.mkdirSync(path.join(ROOT, "source-data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "source-data", slug + ".json"), JSON.stringify(out, null, 2));
console.log(`✓ ${h.itemName} (${h.entpName}) → source-data/${slug}.json`);
