#!/usr/bin/env node
/**
 * 소스 무결성 수리 (2026-07-02 — 품목번호 공유 536페이지 오염 사고)
 *
 * 원인: fetch-source.js findEdrugItem의 완화 매칭(접두어 2~4글자, 최단이름 선택)이
 *       다른 제품의 e약은요 데이터를 복사해 옴 → 같은 itemSeq를 여러 슬러그가 공유.
 * 원칙: 이 스크립트는 "엄격 일치"만 허용. 추측 매칭 0. 못 찾으면 유령 후보로 보고만 한다.
 *
 * 사용 (사용자 PC, .env.local의 DRUG_PERMIT_API_KEY 필요):
 *   node scripts/repair-source-integrity.js --download   # e약은요 전체 덤프 갱신 (최초 1회, ~5분)
 *   node scripts/repair-source-integrity.js --scan       # 오염 분류만 (API 안 씀)
 *   node scripts/repair-source-integrity.js --repair     # 스캔 + 엄격재매칭 + 소스 교체 (resume 안전)
 *   node scripts/repair-source-integrity.js --repair --limit 50   # 50건만
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "source-data");
const CACHE = path.join(ROOT, "tmp", "edrug-all.json");
const LOG = path.join(ROOT, "_workspace", "source-repair-log.json");
const GHOST_MD = path.join(ROOT, "reports", "유령페이지-후보-2026-07-02.md");

// .env.local 로드
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const args = process.argv.slice(2);
const MODE = args.includes("--download") ? "download" : args.includes("--repair") ? "repair" : "scan";
const LIMIT = args.includes("--limit") ? +args[args.indexOf("--limit") + 1] : Infinity;
const today = new Date().toISOString().slice(0, 10);

const norm = (t) => String(t || "").replace(/\(.*?\)/g, "").replace(/[\s\-·・（）()\[\]]/g, "")
  .replace(/밀리그람|밀리그램/g, "mg").toLowerCase();

// ── 1) e약은요 전체 덤프 다운로드 ──
async function download() {
  const KEY = process.env.DRUG_PERMIT_API_KEY;
  if (!KEY) { console.error("DRUG_PERMIT_API_KEY 없음 (.env.local)"); process.exit(1); }
  const get = (url) => new Promise((res, rej) => https.get(url, (r) => {
    let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b));
  }).on("error", rej));
  const base = `https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=100`;
  let page = 1, all = [], total = Infinity;
  while ((page - 1) * 100 < total) {
    const raw = await get(`${base}&pageNo=${page}`);
    let j; try { j = JSON.parse(raw); } catch { console.error(`page ${page} 응답 파싱 실패:`, raw.slice(0, 200)); process.exit(1); }
    const body = j.body || {};
    total = body.totalCount || 0;
    all = all.concat(body.items || []);
    if (page % 10 === 0) console.log(`  ${all.length}/${total}...`);
    page++; await new Promise((r) => setTimeout(r, 150));
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ fetchedAt: today, body: { items: all } }));
  console.log(`✅ e약은요 덤프 완료: ${all.length}건 → tmp/edrug-all.json`);
}

// ── 2) 오염 분류 ──
function classify() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".json") && f !== "source-map.json" && f !== "schema.json");
  const bySeq = {}; const meta = {};
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
    const slug = f.replace(/\.json$/, "");
    meta[slug] = { itemSeq: j.itemSeq || "", itemName: j.itemName || "", category: j.category || "" };
    if (j.itemSeq) (bySeq[j.itemSeq] = bySeq[j.itemSeq] || []).push(slug);
  }
  const contaminated = [];
  for (const [seq, slugs] of Object.entries(bySeq)) {
    if (slugs.length < 2) continue;
    // 소유자: itemName 본체와 슬러그가 정확 일치하는 것
    const owner = slugs.find((sl) => norm(meta[sl].itemName) === norm(sl)) || null;
    for (const sl of slugs) if (sl !== owner) contaminated.push({ slug: sl, reason: `itemSeq ${seq} 공유(${slugs.length})`, cat: meta[sl].category });
  }
  // 제형 불일치 (중복 아니어도)
  for (const [sl, m] of Object.entries(meta)) {
    if (contaminated.find((x) => x.slug === sl)) continue;
    for (const form of ["연질캡슐", "캡슐", "정", "액", "겔", "폼", "크림"]) {
      if (sl.replace(/[0-9.]+(mg)?$/, "").endsWith(form)) {
        if (m.itemName && !m.itemName.includes(form)) contaminated.push({ slug: sl, reason: `제형 불일치(${form} vs ${m.itemName.slice(0, 16)})`, cat: m.category });
        break;
      }
    }
  }
  return { contaminated, meta };
}

// ── 3) 엄격 재매칭 + 교체 ──
function strictFind(items, slug, productName) {
  const ns = norm(slug);
  const uniq = (arr) => (arr.length === 1 ? arr[0] : null);
  // 1) 완전 일치
  let r = uniq(items.filter((x) => norm(x.itemName) === ns)); if (r) return r;
  // 2) 함량(mg) 표기 차이 흡수
  const strip = (t) => t.replace(/[0-9.]+mg/g, "");
  r = uniq(items.filter((x) => strip(norm(x.itemName)) === strip(ns) && strip(ns).length >= 4)); if (r) return r;
  // 3) 농도 표기: 슬러그 끝 숫자 = 식약처명 숫자% (신신미녹시딜액5 ↔ 신신미녹시딜액5%)
  r = uniq(items.filter((x) => norm(x.itemName).replace(/%/g, "") === ns)); if (r) return r;
  // 4) 제형어 생략: 슬러그+제형 = 식약처명 (까스활명수 ↔ 까스활명수액)
  for (const form of ["액", "정", "연고", "크림", "겔", "캡슐", "시럽", "과립"]) {
    r = uniq(items.filter((x) => norm(x.itemName) === ns + form)); if (r) return r;
  }
  // 5) 제품 데이터 이름 힌트로 제형 판별 (후시딘 → products name "후시딘 연고 10g" → 후시딘연고)
  if (productName) {
    const np = norm(productName).replace(/[0-9.]+(g|ml|mg|정|캡슐|매|포|개|병)/g, "");
    r = uniq(items.filter((x) => {
      const ni = strip(norm(x.itemName)).replace(/%/g, "");
      return ni === np || ni === np.replace(/(액|정|연고|크림|겔|캡슐)$/, "") ;
    })); if (r) return r;
  }
  return null;
}

// ── 3.5) 허가정보 API(전 품목 DB)에서 유령 후보 재검색 — e약은요에 없는 제네릭 구제 ──
async function permitRepair() {
  const KEY = process.env.DRUG_PERMIT_API_KEY;
  if (!KEY) { console.error("DRUG_PERMIT_API_KEY 없음"); process.exit(1); }
  const get = (url) => new Promise((res, rej) => https.get(url, (r) => {
    let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b));
  }).on("error", rej));
  const flat = (doc) => String(doc || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, " $1 ")   // CDATA 본문 보존 (2026-07-02: 태그제거가 본문째 삭제하던 버그)
    .replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};
  const ghosts = Object.entries(log).filter(([k, v]) => v.result === "GHOST_CANDIDATE" || v.result === "GHOST_CONFIRMED").map(([k]) => k);
  // 제품 데이터에서 slug → name 힌트 로드
  const prodName = {};
  try {
    for (const f of fs.readdirSync(path.join(ROOT, "data", "products")).filter((x) => x.endsWith(".ts"))) {
      const src2 = fs.readFileSync(path.join(ROOT, "data", "products", f), "utf8");
      for (const b of src2.split(/slug: "/).slice(1)) {
        const sl = b.slice(0, b.indexOf('"')); const nm = (b.match(/name: "([^"]+)"/) || [])[1];
        if (sl && nm) prodName[sl] = nm;
      }
    }
  } catch {}
  console.log(`허가정보 API 재검색 대상(유령 후보): ${ghosts.length}건`);
  let ok = 0, still = 0, debugged = false;
  for (const slug of ghosts.slice(0, LIMIT)) {
    // 검색어: 슬러그에서 mg 표기 제거한 이름 (허가 DB item_name은 한글 함량 표기)
    const q = slug.replace(/[0-9.]+(mg)?$/, "");
    const url = `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=50&pageNo=1&item_name=${encodeURIComponent(q)}`;
    const raw = await get(url);
    let j; try { j = JSON.parse(raw); } catch (e) { console.error(`  ${slug}: 응답 파싱 실패 → 원문: ${raw.slice(0, 220).replace(/\s+/g, " ")}`); continue; }
    const items = ((j.body || {}).items) || [];
    if (!debugged && items.length) { debugged = true; console.log("  [응답 필드 확인]", Object.keys(items[0]).slice(0, 12).join(",")); }
    const cand = items.map((x) => ({
      itemName: x.ITEM_NAME || x.itemName || "", entpName: x.ENTP_NAME || x.entpName || "",
      itemSeq: String(x.ITEM_SEQ || x.itemSeq || ""), ee: x.EE_DOC_DATA || x.eeDocData || "",
      ud: x.UD_DOC_DATA || x.udDocData || "", nb: x.NB_DOC_DATA || x.nbDocData || "",
      etc: x.ETC_OTC_CODE || x.etcOtcCode || "", permitDate: x.ITEM_PERMIT_DATE || "",
    }));
    const hit = strictFind(cand, slug, prodName[slug]);
    const docLen = hit ? (flat(hit.ee) + flat(hit.ud) + flat(hit.nb)).length : 0;
    if (hit && docLen > 100) {
      const p2 = path.join(SRC, slug + ".json");
      const old = fs.existsSync(p2) ? JSON.parse(fs.readFileSync(p2, "utf8")) : {};
      fs.writeFileSync(p2, JSON.stringify({
        slug, category: old.category || "", sourceType: "api",
        sourceOrigin: "식약처 허가정보 API 재수집(무결성 수리 2026-07-02)", fetchedAt: today,
        itemName: hit.itemName, entpName: hit.entpName, itemSeq: hit.itemSeq,
        efcyQesitm: flat(hit.ee), useMethodQesitm: flat(hit.ud),
        atpnWarnQesitm: "", atpnQesitm: flat(hit.nb), intrcQesitm: "", seQesitm: "",
        depositMethodQesitm: "", itemImage: old.itemImage || "", updateDe: hit.permitDate,
      }, null, 2));
      log[slug] = { result: "REPAIRED_PERMIT", itemSeq: hit.itemSeq, at: today };
      ok++;
    } else {
      const packM = slug.match(/^(.+?)(큐)?[0-9]+(병|포|매|정|캡슐|개|밀리리터|ml)$/);
      const isPack = packM && fs.existsSync(path.join(SRC, packM[1] + ".json"));
      log[slug] = { result: isPack ? "PACK_VARIANT" : "GHOST_CONFIRMED", at: today };
      still++;
    }
    fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
    if ((ok + still) % 20 === 0) console.log(`  진행 ${ok + still}건 (교체 ${ok})...`);
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\n══ 허가DB 수리: 교체 ${ok} / 진짜 유령 확정 ${still}`);
  console.log("다음: node scripts/verify-slug-integrity.js");
}

async function main() {
  if (args.includes("--permit")) return permitRepair();
  if (MODE === "download") return download();
  const { contaminated } = classify();
  console.log(`오염 분류: ${contaminated.length}건`);
  if (MODE === "scan") {
    for (const c of contaminated.slice(0, 30)) console.log(` - [${c.cat}] ${c.slug}: ${c.reason}`);
    if (contaminated.length > 30) console.log(` ... 외 ${contaminated.length - 30}건`);
    return;
  }
  if (!fs.existsSync(CACHE)) { console.error("tmp/edrug-all.json 없음 → 먼저 --download 실행"); process.exit(1); }
  const items = (JSON.parse(fs.readFileSync(CACHE, "utf8")).body || {}).items || [];
  console.log(`e약은요 덤프: ${items.length}건 로드`);
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : {};
  let repaired = 0, ghosts = [], skipped = 0;
  for (const c of contaminated) {
    if (log[c.slug]) { skipped++; continue; }
    if (repaired + ghosts.length >= LIMIT) break;
    const hit = strictFind(items, c.slug);
    if (hit) {
      const p = path.join(SRC, c.slug + ".json");
      const old = JSON.parse(fs.readFileSync(p, "utf8"));
      const next = {
        slug: c.slug, category: old.category || c.cat, sourceType: "api",
        sourceOrigin: "e약은요 API 재수집(무결성 수리 2026-07-02)", fetchedAt: today,
        itemName: hit.itemName || "", entpName: hit.entpName || "", itemSeq: hit.itemSeq || "",
        efcyQesitm: (hit.efcyQesitm || "").trim(), useMethodQesitm: (hit.useMethodQesitm || "").trim(),
        atpnWarnQesitm: (hit.atpnWarnQesitm || "").trim(), atpnQesitm: (hit.atpnQesitm || "").trim(),
        intrcQesitm: (hit.intrcQesitm || "").trim(), seQesitm: (hit.seQesitm || "").trim(),
        depositMethodQesitm: (hit.depositMethodQesitm || "").trim(),
        itemImage: hit.itemImage || "", updateDe: hit.updateDe || "",
      };
      fs.writeFileSync(p, JSON.stringify(next, null, 2));
      log[c.slug] = { result: "REPAIRED", itemSeq: hit.itemSeq, at: today };
      repaired++;
      if (repaired % 25 === 0) console.log(`  수리 ${repaired}건...`);
    } else {
      log[c.slug] = { result: "GHOST_CANDIDATE", reason: c.reason, at: today };
      ghosts.push(c);
    }
    fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
  }
  if (ghosts.length) {
    const lines = [`# 유령 페이지 후보 (${today})`, "", "e약은요 전체 덤프에서 엄격 일치하는 실제 품목을 찾지 못한 슬러그.",
      "조치: 사람 확인 후 ① 페이지 삭제+동일성분 페이지로 301 ② 이름 교정 후 재수집.", ""];
    for (const g of ghosts) lines.push(`- [${g.cat}] ${g.slug} — ${g.reason}`);
    fs.appendFileSync(GHOST_MD, lines.join("\n") + "\n");
  }
  console.log(`\n══ 수리 결과: 교체 ${repaired} / 유령 후보 ${ghosts.length} / 기존 처리 스킵 ${skipped}`);
  console.log("다음: node scripts/verify-slug-integrity.js  (무결성 맵 재생성) → 큐 재점검");
}
main().catch((e) => { console.error(e); process.exit(1); });
