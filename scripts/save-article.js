#!/usr/bin/env node
/** save-article.js — 검사 통과 글을 data/articles 에 저장 (리라이트 = 교체, 신규 = 추가). 2026-10-20
 *  사용: node scripts/save-article.js {카테고리/슬러그} {draft.json}
 *  - 기존 글: public/data/{카테고리}/{슬러그}.json 을 바탕으로 draft 필드만 덮어써 같은 자리에 교체 (작성일·제품·가격범위 등 보존)
 *    → 먼저 node scripts/generate-article-json.mjs 로 public/data 가 최신이어야 한다
 *  - 신규 글: 카테고리의 마지막 데이터 파일(spokes 객체) 끝에 추가
 *  저장 뒤 TypeScript 구문 검사. 실패하면 원복.
 */
const fs = require("fs");
const path = require("path");
const [key, draftPath] = process.argv.slice(2);
if (!key || !key.includes("/") || !draftPath) { console.error("usage: node scripts/save-article.js {카테고리/슬러그} {draft.json}"); process.exit(2); }
const [cat, slug] = key.split("/");
const d = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const DIR = "data/articles";

// open 위치의 "{" 와 짝이 맞는 "}" 위치 (문자열 안의 괄호는 무시)
function matchBrace(s, open) {
  let depth = 0;
  for (let p = open; p < s.length; p++) {
    const ch = s[p];
    if (ch === '"') { p++; while (p < s.length && s[p] !== '"') { if (s[p] === "\\") p++; p++; } continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return p;
  }
  return -1;
}
// 기존 글 블록의 시작·끝(뒤 콤마 포함)
function blockRange(s, slug) {
  const m = new RegExp(`\\n(\\s*)(?:"${slug}"|${slug}): \\{`).exec(s);
  if (!m) return null;
  const close = matchBrace(s, s.indexOf("{", m.index + 1));
  if (close < 0) return null;
  return { start: m.index + 1, end: close + 1 + (s[close + 1] === "," ? 1 : 0), indent: m[1] };
}

const files = fs.readdirSync(DIR).filter((f) => f === cat + ".ts" || new RegExp(`^${cat}-\\d+\\.ts$`).test(f));
let target = null;
for (const f of files) { const s = fs.readFileSync(path.join(DIR, f), "utf8"); const r = blockRange(s, slug); if (r) { target = { f, s, ...r }; break; } }

const pick = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !["product", "calc"].includes(k)));
let base, file, src, start, end, indent;
if (target) {
  const pub = path.join("public", "data", cat, slug + ".json");
  if (!fs.existsSync(pub)) { console.error(`SAVE_FAIL ${pub} 없음 — node scripts/generate-article-json.mjs 먼저`); process.exit(1); }
  base = JSON.parse(fs.readFileSync(pub, "utf8"));
  ({ f: file, s: src, start, end, indent } = target);
} else {
  // 신규: 번호 파일이 있으면 가장 큰 번호, 없으면 {cat}.ts 의 spokes 객체 끝
  const numbered = files.filter((f) => f !== cat + ".ts").sort((a, b) => +a.match(/-(\d+)\./)[1] - +b.match(/-(\d+)\./)[1]);
  file = numbered.length ? numbered[numbered.length - 1] : cat + ".ts";
  if (!fs.existsSync(path.join(DIR, file))) { console.error(`SAVE_FAIL 카테고리 파일 없음: ${cat}`); process.exit(1); }
  src = fs.readFileSync(path.join(DIR, file), "utf8");
  const sp = src.indexOf("export const spokes");
  const close = sp < 0 ? -1 : matchBrace(src, src.indexOf("{", src.indexOf("=", sp)));
  if (close < 0) { console.error(`SAVE_FAIL ${file} 에서 spokes 객체를 찾지 못함`); process.exit(1); }
  start = end = close; // spokes 객체의 닫는 괄호 바로 앞에 삽입
  indent = "  ";
  base = { slug, categorySlug: cat, datePublished: today, products: [] };
}

const article = { ...base, ...pick(d), slug, categorySlug: cat, h1: d.title, description: d.description || String(d.metaDescription || "").slice(0, 85), dateModified: today, showToc: true };
const json = JSON.stringify(article, null, 1).split("\n").map((l, i) => (i ? indent + l : l)).join("\n");
const block = `${indent}"${slug}": ${json},\n`;
const out = target ? src.slice(0, start) + block + src.slice(end).replace(/^\n/, "") : src.slice(0, start) + block + src.slice(start);
fs.writeFileSync(path.join(DIR, file), out);

const ts = require(path.join(process.cwd(), "node_modules", "typescript", "lib", "typescript.js"));
const sf = ts.createSourceFile("a.ts", out, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
if (sf.parseDiagnostics.length) { fs.writeFileSync(path.join(DIR, file), src); console.error(`SAVE_FAIL ${key} TS 구문 오류 → 원복`); process.exit(1); }
console.log(`SAVED ${key} → ${DIR}/${file} (${target ? "교체" : "신규 추가"})`);
