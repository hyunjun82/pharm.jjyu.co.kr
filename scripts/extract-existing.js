#!/usr/bin/env node
/** 기존 data/articles/{cat}.ts에서 슬러그 블록 추출 → _workspace/batch-logs/draft-{slug}.json
 *  사용: node scripts/extract-existing.js 제산제.ts 슬러그1,슬러그2,...
 */
const fs = require("fs");
const [file, slugArg] = process.argv.slice(2);
const slugs = slugArg.split(",").map((x) => x.trim()).filter(Boolean);
const tsSrc = fs.readFileSync("data/articles/" + file, "utf8");

function extract(tsSrc, slug) {
  const keys = [`  "${slug}": {`, `    "${slug}": {`, `  ${slug}: {`, `    ${slug}: {`];
  let i = -1;
  for (const k of keys) { i = tsSrc.indexOf(k); if (i > -1) break; }
  if (i < 0) return null;
  let p = tsSrc.indexOf("{", i), depth = 0, end = -1;
  for (; p < tsSrc.length; p++) {
    const c = tsSrc[p];
    if (c === '"') { p++; while (p < tsSrc.length && tsSrc[p] !== '"') { if (tsSrc[p] === "\\") p++; p++; } continue; }
    if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = p + 1; break; } }
  }
  if (end < 0) return null;
  const block = tsSrc.slice(i, end);
  const g = (re) => { const m = block.match(re); return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : ""; };
  const title = g(/\btitle:\s*"((?:[^"\\]|\\.)*)"/);
  const meta = g(/metaDescription:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
  const hero = g(/heroDescription:\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
  const sections = [...block.matchAll(/title:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*content:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)]
    .map((x) => ({ title: x[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'), content: x[2].replace(/\\n/g, "\n").replace(/\\"/g, '"') }));
  const faq = [...block.matchAll(/question:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)]
    .map((x) => ({ question: x[1].replace(/\\n/g, "\n"), answer: x[2].replace(/\\n/g, "\n").replace(/\\"/g, '"') }));
  if (!title || !sections.length) return null;
  return { title, metaDescription: meta, heroDescription: hero, sections, faq };
}

fs.mkdirSync("_workspace/batch-logs", { recursive: true });
for (const slug of slugs) {
  const d = extract(tsSrc, slug);
  if (!d) { console.log(`❌ ${slug} 추출 실패`); continue; }
  fs.writeFileSync(`_workspace/batch-logs/draft-${slug}.json`, JSON.stringify(d, null, 1));
  console.log(`✅ ${slug} 추출 완료 (섹션 ${d.sections.length}, FAQ ${d.faq.length})`);
}
