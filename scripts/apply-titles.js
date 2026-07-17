#!/usr/bin/env node
/** apply-titles.js — rewrite-plan.json의 newTitle을 data/articles에 반영
 *  - spoke 블록: title + h1 교체 (섹션/FAQ title은 건드리지 않음)
 *  - 허브 spokes[] 목록의 링크 title도 동기화
 */
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync("_workspace/rewrite-plan.json", "utf8"))
  .filter((x) => x.action === "retitle" && x.newTitle);
const bySlug = {};
plan.forEach((x) => (bySlug[x.slug] = x.newTitle));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let spokeUpd = 0, hubUpd = 0;

for (const f of fs.readdirSync("data/articles").filter((f) => f.endsWith(".ts"))) {
  let src = fs.readFileSync("data/articles/" + f, "utf8");
  let changed = false;
  // 1) spoke 본체: slug→categorySlug 앵커 후 첫 title/h1
  src = src.replace(
    /(slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"[^"]+",[\s\S]{0,400}?title:\s*)"((?:[^"\\]|\\.)*)"/g,
    (m0, pre, slug, old) => {
      const nt = bySlug[slug];
      if (!nt) return m0;
      spokeUpd++; changed = true;
      return pre + JSON.stringify(nt).slice(1, -1).replace(/^/, '"') + '"';
    }
  );
  // h1: title 교체된 슬러그에 대해 h1도 동일화
  src = src.replace(
    /(slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"[^"]+",[\s\S]{0,600}?h1:\s*)"((?:[^"\\]|\\.)*)"/g,
    (m0, pre, slug) => {
      const nt = bySlug[slug];
      if (!nt) return m0;
      changed = true;
      return pre + '"' + nt.replace(/"/g, '\\"') + '"';
    }
  );
  // 2) 허브 목록: { slug: "X", title: "..." } (categorySlug 없는 짧은 블록)
  src = src.replace(
    /(\{\s*\n?\s*slug:\s*"([^"]+)",\s*\n\s*title:\s*)"((?:[^"\\]|\\.)*)"/g,
    (m0, pre, slug) => {
      const nt = bySlug[slug];
      if (!nt) return m0;
      hubUpd++; changed = true;
      return pre + '"' + nt.replace(/"/g, '\\"') + '"';
    }
  );
  if (changed) fs.writeFileSync("data/articles/" + f, src);
}
console.log("spoke title 교체:", spokeUpd, "| 허브 목록 동기화:", hubUpd);
