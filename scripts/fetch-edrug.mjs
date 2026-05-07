/**
 * e약은요(의약품개요정보) API → tmp/edrug-all.json 캐시 생성
 *
 * 사용법:
 *   node scripts/fetch-edrug.mjs                 # 전체 다운로드 (~30k건, 약 5분)
 *   node scripts/fetch-edrug.mjs --query 겔포스   # 특정 이름만 검색
 *   node scripts/fetch-edrug.mjs --max 1000      # 최대 N건만
 *
 * API 키:
 *   .env.local의 EDRUG_API_KEY 자동 로드 (gitignore됨, 커밋 안 됨)
 *
 * 다음 단계:
 *   node scripts/fetch-source.js --category 제산제   # 캐시 → 카테고리별 source-data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, "tmp");
const CACHE_FILE = path.join(TMP_DIR, "edrug-all.json");
const ENV_FILE = path.join(ROOT, ".env.local");

const API_BASE = "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";
const PAGE_SIZE = 100;

// ── .env.local 로드 ─────────────────────────────────────────────
function loadEnvKey() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error("❌ .env.local 파일 없음:", ENV_FILE);
    console.error("   data.go.kr에서 e약은요 API 키 발급 후 다음 형식으로 저장하세요:");
    console.error("   EDRUG_API_KEY=발급받은키");
    process.exit(1);
  }
  const content = fs.readFileSync(ENV_FILE, "utf8");
  const m = content.match(/^EDRUG_API_KEY\s*=\s*(.+)$/m);
  if (!m) {
    console.error("❌ .env.local에 EDRUG_API_KEY가 없음");
    process.exit(1);
  }
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// ── API 호출 ────────────────────────────────────────────────────
async function fetchPage(apiKey, pageNo, query) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    type: "json",
  });
  if (query) params.set("itemName", query);
  const url = `${API_BASE}?${params}`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  // 응답 형식: { header, body: { items: [...], totalCount, pageNo, numOfRows } }
  // 또는 에러 시: { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg, returnAuthMsg } } }
  if (data.OpenAPI_ServiceResponse) {
    const err = data.OpenAPI_ServiceResponse.cmmMsgHeader;
    throw new Error(`API 오류: ${err.errMsg} / ${err.returnAuthMsg}`);
  }
  const total = Number(data?.body?.totalCount || 0);
  let items = data?.body?.items || [];
  if (!Array.isArray(items)) items = [items];
  return { items, total };
}

// ── 메인 ────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const query = args.includes("--query") ? args[args.indexOf("--query") + 1] : null;
  const maxArg = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : null;

  const apiKey = loadEnvKey();
  console.log("=== e약은요 API 다운로드 시작 ===");
  console.log(`키: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  console.log(`쿼리: ${query || "전체"}`);
  console.log("");

  fs.mkdirSync(TMP_DIR, { recursive: true });

  const all = [];
  let page = 1;
  let total = 0;

  while (true) {
    const { items, total: t } = await fetchPage(apiKey, page, query);
    if (page === 1) {
      total = t;
      console.log(`총 ${total.toLocaleString()}건 — 페이지 ${Math.ceil(total / PAGE_SIZE)}개 다운로드 시작`);
    }
    if (items.length === 0) break;
    all.push(...items);
    process.stdout.write(`\r페이지 ${page} (${all.length.toLocaleString()}/${total.toLocaleString()})  `);

    if (maxArg && all.length >= maxArg) {
      console.log(`\n--max ${maxArg} 도달, 중단`);
      break;
    }
    if (all.length >= total) break;
    page++;
    // rate limit 보호 (data.go.kr 권장)
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log("");

  // 캐시 저장 (fetch-source.js가 읽는 형식과 동일: { body: { items } })
  const out = { body: { items: all, totalCount: all.length } };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(out));
  const sizeMb = (fs.statSync(CACHE_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`✅ 저장 완료: ${CACHE_FILE} (${sizeMb}MB, ${all.length.toLocaleString()}건)`);
  console.log("");
  console.log("다음 단계:");
  console.log("  node scripts/fetch-source.js --category 제산제");
  console.log("  → source-data/{slug}.json 21개 생성");
}

main().catch((err) => {
  console.error("\n❌ 실패:", err.message);
  process.exit(1);
});
