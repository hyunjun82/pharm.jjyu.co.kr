#!/usr/bin/env node
/** 1단계: 전 슬러그 데이터 무결성 맵 생성 → _workspace/integrity-map.json
 *  상태: VERIFIED(리라이트 가능) | MISMATCH(분류·함량 불일치, 교정 리라이트) | NEEDS_REFETCH(소스 재수집 전 작성 금지)
 */
const fs = require("fs");
const sd = {}; // slug → source json
for (const f of fs.readdirSync("source-data").filter((f) => f.endsWith(".json"))) {
  try { const j = JSON.parse(fs.readFileSync("source-data/" + f, "utf8")); sd[j._slug || j.slug || f.replace(".json", "")] = j; } catch (e) {}
}
const products = {};
for (const f of fs.readdirSync("data/products").filter((f) => f.endsWith(".ts"))) {
  const src = fs.readFileSync("data/products/" + f, "utf8");
  for (const b of src.split(/\{\s*\n\s*id:/).slice(1)) {
    const g = (re) => (b.match(re) || [])[1];
    const slug = g(/slug: "([^"]+)"/); if (!slug) continue;
    products[slug] = { name: g(/name: "([^"]+)"/) || "", desc: g(/description: "([^"]+)"/) || "", price: +(g(/price: (\d+)/) || 0), unit: g(/unit: "([^"]+)"/) || "" };
  }
}
const out = [];
for (const f of fs.readdirSync("data/articles").filter((f) => f.endsWith(".ts") && !/^(index|build-all)/.test(f))) {
  const src = fs.readFileSync("data/articles/" + f, "utf8");
  let m; const re = /slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"([^"]+)",/g;
  while ((m = re.exec(src))) {
    const [_, slug, cat] = m;
    const s = sd[slug]; const p = products[slug] || {};
    const issues = [];
    let status = "VERIFIED";
    if (!s) { issues.push("소스파일 없음"); status = "NEEDS_REFETCH"; }
    else {
      if (s.sourceType === "nedrug-template") { issues.push("템플릿클론: " + (s.nedrug_ref || "?")); status = "NEEDS_REFETCH"; }
      if (!s.itemSeq && !s.STTEMNT_NO && s.sourceType !== "nedrug-template") { issues.push("품목/신고번호 없음"); status = "NEEDS_REFETCH"; }
      // 슬러그↔itemName 일치 (피나원 사고 방지 규칙)
      const iname = (s.itemName || s.PRDUCT || "").replace(/\s|\(.*?\)/g, "");
      if (iname && !iname.includes(slug.replace(/\s/g, "")) && !slug.replace(/\s/g, "").includes(iname.slice(0, 4))) {
        issues.push("slug↔itemName 불일치: " + (s.itemName || s.PRDUCT));
        if (status === "VERIFIED") status = "MISMATCH";
      }
    }
    // 카테고리-적응증 불일치 (전립선 5mg이 탈모에 등)
    const efcy = s ? (s.efcyQesitm || s.MAIN_FNCTN || "") : "";
    if (cat === "탈모" && /전립샘|전립선/.test(efcy) && !/탈모/.test(efcy)) {
      issues.push("적응증=전립선(탈모 아님) → 교정 리라이트 필수");
      if (status === "VERIFIED") status = "MISMATCH";
    }
    // 가격 신뢰도
    const priceFlag = p.price > 0 ? (p.price < 1000 ? "가격의심(과소)" : "있음") : "없음";
    out.push({ slug, cat, file: f, status, issues, price: p.price || 0, priceFlag });
  }
}
fs.writeFileSync("_workspace/integrity-map.json", JSON.stringify(out, null, 1));
const c = {}; out.forEach((x) => (c[x.status] = (c[x.status] || 0) + 1));
console.log("무결성 맵:", JSON.stringify(c), "/ 총", out.length);
console.log("가격 없음:", out.filter((x) => x.priceFlag === "없음").length, "| 가격 의심:", out.filter((x) => x.priceFlag === "가격의심(과소)").length);
