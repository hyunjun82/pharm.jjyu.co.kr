#!/usr/bin/env node
/** patch-barkiri-price.mjs — 기존 글 가격 섹션에 발키리 실거래 범위 자동 주입 (2026-07-17 신설)
 *  judge 전원 FAIL의 공통 사유("기준가만 있고 실거래 없음")를 리라이트 없이 해소하는 패처.
 *  사용: node scripts/patch-barkiri-price.mjs {cat}/{slug} [--apply]
 *    기본 = 드라이런(변경 미저장, 게이트 결과만 출력). --apply 시에만 저장.
 *  동작: 제품 pid → data/barkiri-prices.json 조회 → 가격 H2 섹션 첫머리에 실거래 문단 삽입
 *        → 게이트(validate·human-feel·score) 통과 시에만 저장. 실패 시 원복.
 */
import fs from "fs";
import { execSync } from "child_process";

const [target, applyFlag] = process.argv.slice(2);
const APPLY = applyFlag === "--apply";
if (!target || !target.includes("/")) { console.error("사용: node scripts/patch-barkiri-price.mjs {cat}/{slug} [--apply]"); process.exit(1); }
const [cat, slug] = target.split("/");

// 1) pid + 발키리 데이터
const psrc = fs.readFileSync(`data/products/${cat}.ts`, "utf8");
const si = psrc.indexOf(`slug: "${slug}"`);
if (si < 0) { console.error(`제품 데이터에 ${slug} 없음`); process.exit(1); }
const win = psrc.slice(Math.max(0, si - 600), si);
const pid = (win.match(/barkiryProductId:\s*"(p\d+)"/g) || []).pop()?.match(/p\d+/)?.[0];
if (!pid) { console.log(`SKIP: ${slug} 발키리 미연동`); process.exit(0); }
let pdb = {};
try { pdb = JSON.parse(fs.readFileSync("data/barkiri-prices.json", "utf8")); } catch {}
const bp = pdb[pid];
if (!bp || bp.error || !bp.lowPrice) { console.log(`SKIP: ${pid} 실거래 데이터 없음 (fetch-barkiri-prices 먼저 실행)`); process.exit(0); }
if (bp.lowPrice === bp.highPrice) { console.log(`SKIP: ${pid} 단일가(파트너 1곳) — 범위 서술 부적합`); process.exit(0); }

// 2) 글 파일에서 블록 찾기
const files = fs.readdirSync("data/articles").filter((f) => f.endsWith(".ts") && (f === cat + ".ts" || f.startsWith(cat + "-")));
let file = null, src = null, bs = -1, be = -1;
function braceEnd(s, start) { let p = start, d = 0; for (; p < s.length; p++) { const c = s[p]; if (c === '"') { p++; while (p < s.length && s[p] !== '"') { if (s[p] === "\\") p++; p++; } continue; } if (c === "{") d++; else if (c === "}") { d--; if (d === 0) return p + 1; } } return -1; }
for (const f of files) {
  const s = fs.readFileSync("data/articles/" + f, "utf8");
  for (const key of [`\n    ${slug}: {`, `\n    "${slug}": {`, `\n  ${slug}: {`, `\n  "${slug}": {`]) {
    const i = s.indexOf(key);
    if (i > -1) { file = "data/articles/" + f; src = s; bs = s.indexOf("{", i); be = braceEnd(s, bs); break; }
  }
  if (file) break;
}
if (!file || be < 0) { console.error(`글 블록 못 찾음: ${target}`); process.exit(1); }
const block = src.slice(bs, be);

// 3) 가격 섹션 content 찾기 (H2에 '가격' 포함)
const secRe = /title:\s*"([^"]*가격[^"]*)",\s*\n\s*content:\s*\n?\s*"((?:[^"\\]|\\.)*)"/;
const m = block.match(secRe);
if (!m) { console.log(`SKIP: ${slug} 가격 H2 없음 (구조 상이 — 수동 처리 대상)`); process.exit(0); }
if (/실거래[^.]{0,30}[\d,]+\s*원/.test(m[2])) { console.log(`SKIP: ${slug} 이미 실거래 수치 서술 있음`); process.exit(0); }

// 4) 실거래 문단 삽입 (기존 내용 앞)
const injectSent = `${bp.fetchedAt} 기준 발키리 인증 약국 ${bp.storeCount}곳의 실거래 데이터를 보면 ${bp.name} 가격은 ${bp.lowPrice.toLocaleString()}원에서 ${bp.highPrice.toLocaleString()}원 사이예요. 같은 제품이라도 약국에 따라 ${(bp.highPrice - bp.lowPrice).toLocaleString()}원까지 차이가 나는 셈이죠.`;
const noDataRe = /[^.\\]*실거래[^.]*?(?:확인되지 않아|미확인)[^.]*\.\s?/;
let newBlock;
if (noDataRe.test(m[2])) {
  newBlock = block.replace(secRe, (all, t, c) => all.replace(c, c.replace(noDataRe, injectSent + " ")));
} else {
  newBlock = block.replace(secRe, (all, t, c) => all.replace(c, injectSent + "\\n\\n" + c));
}
const newSrc = src.slice(0, bs) + newBlock + src.slice(be);

// 5) 게이트: 패치본 추출 → validate/human/score
const g2 = (re) => { const x = newBlock.match(re); return x ? x[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : ""; };
const draft = {
  title: g2(/\btitle:\s*"((?:[^"\\]|\\.)*)"/),
  metaDescription: g2(/metaDescription:\s*\n?\s*"((?:[^"\\]|\\.)*)"/),
  heroDescription: g2(/heroDescription:\s*\n?\s*"((?:[^"\\]|\\.)*)"/),
  sections: [...newBlock.matchAll(/title:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*content:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => ({ title: x[1].replace(/\\n/g, "\n"), content: x[2].replace(/\\n/g, "\n").replace(/\\"/g, '"') })),
  faq: [...newBlock.matchAll(/question:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => ({ question: x[1], answer: x[2].replace(/\\n/g, "\n") })),
};
const tmp = `_workspace/_patch_${slug}.json`;
fs.writeFileSync(tmp, JSON.stringify(draft));
// 브리프 재생성(화이트리스트에 발키리 숫자 반영)
try { execSync(`node scripts/build-write-brief.js "${slug}"`, { stdio: "pipe" }); } catch (e) { console.log(`SKIP: ${slug} 브리프 차단(NEEDS_REFETCH 소스 오염 — 절대원칙 6) — 소스 수리 전 패치 금지`); process.exit(0); }
let fails = [];
for (const s of ["validate-article", "human-feel", "score-article"]) {
  try { execSync(`node scripts/${s}.js "${slug}" "${tmp}"`, { stdio: "pipe" }); } catch (e) { fails.push(s); }
}
if (fails.length) console.log(fails.map(()=>"").join("")); // keep tmp for debug when fail
if (!fails.length) { try { fs.unlinkSync(tmp); } catch {} }
if (fails.length) { console.log(`❌ ${target} 패치 후 게이트 FAIL(${fails.join(",")}) — 저장 안 함 (수동 검토 대상)`); process.exit(1); }
if (APPLY) {
  fs.writeFileSync(file, newSrc);
  console.log(`✅ ${target} 실거래 주입 + 게이트 통과 → 저장됨 (${bp.lowPrice}~${bp.highPrice}원, ${bp.storeCount}곳)`);
} else {
  console.log(`✅ ${target} 드라이런 통과 (${bp.lowPrice}~${bp.highPrice}원, ${bp.storeCount}곳) — 저장하려면 --apply`);
}
