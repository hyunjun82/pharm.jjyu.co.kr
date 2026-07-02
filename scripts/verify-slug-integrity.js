#!/usr/bin/env node
/** 1단계: 전 슬러그 데이터 무결성 맵 생성 → _workspace/integrity-map.json
 *  상태: VERIFIED(리라이트 가능) | MISMATCH(분류·함량 불일치, 교정 리라이트) | NEEDS_REFETCH(소스 재수집 전 작성 금지)
 */
const fs = require("fs");
const sd = {}; // slug → source json
for (const f of fs.readdirSync("source-data").filter((f) => f.endsWith(".json"))) {
  try { const j = JSON.parse(fs.readFileSync("source-data/" + f, "utf8")); sd[j._slug || j.slug || f.replace(".json", "")] = j; } catch (e) {}
}
// itemSeq → 공유 슬러그 목록 (오염 탐지용)
const SEQ_DUP = {};
for (const [sl, j] of Object.entries(sd)) { if (j.itemSeq) (SEQ_DUP[j.itemSeq] = SEQ_DUP[j.itemSeq] || []).push(sl); }
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
    // ── 2026-07-02 신설: 소스 오염 차단 (536페이지 사고 재발 방지) ──
    // (a) 품목번호 중복: 같은 itemSeq를 여러 슬러그가 공유 = 남의 약 데이터 복제 의심 → 소유자(제품명 일치) 외 전부 차단
    else if (s.itemSeq && SEQ_DUP[s.itemSeq] && SEQ_DUP[s.itemSeq].length > 1) {
      const norm = (t) => String(t||"").replace(/[\s()0-9.밀리그램mg정캡슐연질액겔폼크림포매입]/g, "");
      const owner = SEQ_DUP[s.itemSeq].find((sl) => norm(s.itemName).includes(norm(sl).slice(0, 4)) && norm(sl) === norm((sd[sl]||{}).itemName||sl).slice(0, norm(sl).length)) || null;
      if (slug !== owner) { issues.push("품목번호 " + s.itemSeq + " 중복(" + SEQ_DUP[s.itemSeq].length + "개 슬러그 공유) — 소스 재수집 필요"); status = "NEEDS_REFETCH"; }
    }
    // (b) 제형 불일치: 슬러그 끝 제형(정/캡슐/액/겔/폼/크림)이 소스 itemName에 없음 = 남의 제형 데이터
    if (s && s.itemName && status === "VERIFIED") {
      const formMap = [["연질캡슐","연질캡슐"],["캡슐","캡슐"],["정","정"],["액","액"],["겔","겔"],["폼","폼"],["크림","크림"]];
      for (const [suf, form] of formMap) {
        if (slug.replace(/[0-9.]+(mg)?$/,"").endsWith(suf)) {
          if (!s.itemName.includes(form)) { issues.push("제형 불일치: 슬러그 '"+suf+"' vs 소스 '"+s.itemName.slice(0,20)+"'"); status = "NEEDS_REFETCH"; }
          break;
        }
      }
    }
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
