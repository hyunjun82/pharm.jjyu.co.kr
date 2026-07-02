// 허가정보 API 엔드포인트 자동 탐색 (버전 조합 프로브)
const fs = require("fs"); const path = require("path"); const https = require("https");
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const KEY = process.env.DRUG_PERMIT_API_KEY;
const get = (url) => new Promise((res) => https.get(url, (r) => {
  let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ code: r.statusCode, body: b }));
}).on("error", (e) => res({ code: 0, body: e.message })));
const combos = [];
for (const sv of ["DrugPrdtPrmsnInfoService07","DrugPrdtPrmsnInfoService06","DrugPrdtPrmsnInfoService05","DrugPrdtPrmsnInfoService04","DrugPrdtPrmsnInfoService03","DrugPrdtPrmsnInfoService02","DrugPrdtPrmsnInfoService"])
  for (const op of ["getDrugPrdtPrmsnDtlInq07","getDrugPrdtPrmsnDtlInq06","getDrugPrdtPrmsnDtlInq05","getDrugPrdtPrmsnDtlInq04","getDrugPrdtPrmsnDtlInq03","getDrugPrdtPrmsnDtlInq02","getDrugPrdtPrmsnDtlInq","getDrugPrdtPrmsnInq06","getDrugPrdtPrmsnInq05","getDrugPrdtPrmsnInq"])
    combos.push([sv, op]);
(async () => {
  for (const [sv, op] of combos) {
    const url = `https://apis.data.go.kr/1471000/${sv}/${op}?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=1&pageNo=1&item_name=${encodeURIComponent("활명수")}`;
    const r = await get(url);
    if (r.code === 404 || /API not found/.test(r.body)) continue;
    console.log(`\n★ 응답 있음: ${sv}/${op} (HTTP ${r.code})`);
    console.log("  " + r.body.slice(0, 300).replace(/\s+/g, " "));
    if (/"totalCount"|ITEM_NAME|item_name/i.test(r.body)) { console.log("\n✅ 이 조합이 정답 — 스크립트에 반영하세요"); process.exit(0); }
  }
  console.log("\n전 조합 404 — 키의 활용신청 목록 확인 필요 (방법 A)");
})();
