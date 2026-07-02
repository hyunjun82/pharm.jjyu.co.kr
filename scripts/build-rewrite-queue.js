#!/usr/bin/env node
/** 전 카테고리 리라이트 큐 재생성 (2026-07-02) — 의약품 전 카테고리, 건기식 제외
 * 기준: dateModified < 2026-06-01(구버전) + 무결성 VERIFIED + batch-done 제외. 오래된 순.
 * 사용: node scripts/build-rewrite-queue.js   (기존 큐 백업 후 덮어씀) */
const fs = require("fs"); const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SKIP_CATS = new Set(["유산균", "영양제"]); // 건기식 — 소스 재수집 후 별도
const imap = JSON.parse(fs.readFileSync(path.join(ROOT, "_workspace/integrity-map.json"), "utf8"));
const done = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "_workspace/batch-done.json"), "utf8")));
const ver = new Map(imap.filter((x) => x.status === "VERIFIED").map((x) => [x.slug, x.cat]));
const out = [];
const dataDir = path.join(ROOT, "public", "data");
for (const cat of fs.readdirSync(dataDir)) {
  if (SKIP_CATS.has(cat)) continue;
  const catDir = path.join(dataDir, cat);
  if (!fs.statSync(catDir).isDirectory()) continue;
  for (const f of fs.readdirSync(catDir).filter((x) => x.endsWith(".json"))) {
    const slug = f.replace(/\.json$/, "");
    if (done.has(slug) || !ver.has(slug)) continue;
    let d; try { d = JSON.parse(fs.readFileSync(path.join(catDir, f), "utf8")); } catch { continue; }
    const dm = d.dateModified || "0";
    if (dm >= "2026-06-01") continue; // 이미 신형
    out.push({ slug, cat, dateModified: dm, chars: JSON.stringify(d.sections || "").length });
  }
}
out.sort((a, b) => (a.cat === b.cat ? a.dateModified.localeCompare(b.dateModified) : a.cat.localeCompare(b.cat)));
const QP = path.join(ROOT, "_workspace/rewrite-queue.json");
fs.copyFileSync(QP, QP + ".bak-" + Date.now());
fs.writeFileSync(QP, JSON.stringify(out, null, 1));
const byCat = {}; out.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + 1));
console.log("큐 재생성:", out.length, "편", JSON.stringify(byCat));
