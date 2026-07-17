// 결정 테스트: Service07/DtlInq06 응답의 "전체" 필드와 EE_DOC_DATA 본문 유무 확인
const fs = require("fs"); const path = require("path"); const https = require("https");
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const KEY = process.env.DRUG_PERMIT_API_KEY;
const q = process.argv[2] || "두타스텐";
const url = `https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=3&pageNo=1&item_name=${encodeURIComponent(q)}`;
https.get(url, (r) => {
  let b = ""; r.on("data", (c) => (b += c));
  r.on("end", () => {
    const j = JSON.parse(b); const items = (j.body || {}).items || [];
    console.log("검색어:", q, "| 결과:", items.length, "건");
    if (!items.length) return;
    const it = items[0];
    console.log("제품명:", it.ITEM_NAME, "| 품목번호:", it.ITEM_SEQ);
    console.log("전체 필드(" + Object.keys(it).length + "개):", Object.keys(it).join(","));
    for (const f of ["EE_DOC_DATA", "UD_DOC_DATA", "NB_DOC_DATA"])
      console.log(f + ":", it[f] ? ("✅ 있음 → " + String(it[f]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 120)) : "❌ 없음/null");
  });
});
