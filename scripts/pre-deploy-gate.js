#!/usr/bin/env node
/** 푸시 직전 품질 게이트 v2 (2026-07-17 강화).
 *  사용: node scripts/pre-deploy-gate.js 탈모/미녹시딜,탈모/로게인
 *  v1은 validate+human-feel만 검사 → judge FAIL 15편이 라이브에 올라간 사고의 원인.
 *  v2 검사 체인 (하나라도 FAIL이면 exit 1 = 배포 차단):
 *    ① validate-article (26규칙)  ② human-feel (AI찍어내기)
 *    ③ score-article (표준 13편 하한)  ④ verify-crosssim (도어웨이, 인덱스 있을 때)
 *    ⑤ B20: 타이틀 약속↔서론 즉답 일치 (인라인)
 *    ⑥ satisfaction-judge (claude CLI 있을 때만 — 없으면 경고 후 스킵)
 */
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const arg = process.argv[2] || "";
const items = arg.split(",").map((x) => x.trim()).filter(Boolean);
if (!items.length) { console.log("게이트: 검사할 슬러그 없음(스킵)"); process.exit(0); }

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
  const sections = [...block.matchAll(/title:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*content:\s*\n?\s*(?:"((?:[^"\\]|\\.)*)"|`([^`]*)`)/g)]
    .map((x) => ({ title: x[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'), content: (x[2]||x[3]||"").replace(/\\n/g, "\n").replace(/\\"/g, '"') }));
  const faq = [...block.matchAll(/question:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*answer:\s*\n?\s*(?:"((?:[^"\\]|\\.)*)"|`([^`]*)`)/g)]
    .map((x) => ({ question: x[1].replace(/\\n/g, "\n"), answer: (x[2]||x[3]||"").replace(/\\n/g, "\n").replace(/\\"/g, '"') }));
  if (!title || !sections.length) return null;
  return { title, metaDescription: meta, heroDescription: hero, sections, faq };
}

// B20: 타이틀이 던진 질문/약속에 서론 첫 두 문장이 답하는가 (기계 검사 가능한 범위)
function b20TitleIntroMatch(d) {
  const title = d.title || "";
  const hero = (d.heroDescription || "").slice(0, 160); // 서론 첫머리
  const problems = [];
  // 질문형 타이틀 신호 → 서론 첫머리에 답 신호(숫자·기준·즉답 명사) 요구
  const promises = [
    { sig: /몇\s*(알|정|번|회|시간|살)/, need: /\d/, msg: "타이틀이 '몇~'을 묻는데 서론 첫머리에 숫자 답 없음" },
    { sig: /얼마|가격|최저가/, need: /\d|원|가격/, msg: "타이틀이 가격을 약속하는데 서론 첫머리에 가격 신호 없음" },
    { sig: /언제부터|언제까지|기간/, need: /\d|주|개월|일|시간/, msg: "타이틀이 시점을 묻는데 서론 첫머리에 기간 답 없음" },
    { sig: /vs|차이|비교/, need: /차이|다르|같|비교|갈려/, msg: "타이틀이 비교를 약속하는데 서론 첫머리에 비교 즉답 없음" },
    { sig: /될까|해도 되|괜찮|위험|심할까/, need: /돼요|안 돼요|괜찮|위험|기준|없어요|있어요|허가|금지|말아야|해야/, msg: "타이틀이 가부를 묻는데 서론 첫머리에 가부 즉답 없음" },
  ];
  for (const p of promises) {
    if (p.sig.test(title) && !p.need.test(hero)) problems.push("B20: " + p.msg);
  }
  return problems;
}

let failed = [];
let judgeSkipped = 0;
fs.mkdirSync("_workspace", { recursive: true });
for (const it of items) {
  const [cat, slug] = it.split("/");
  const files = fs.readdirSync("data/articles").filter((f) => f.endsWith(".ts") && (f === cat + ".ts" || f.startsWith(cat + "-")));
  let draft = null;
  for (const f of files) { draft = extract(fs.readFileSync("data/articles/" + f, "utf8"), slug); if (draft) break; }
  if (!draft) { console.log(`❌ ${it} 추출 실패`); failed.push(it); continue; }
  const tmp = `_workspace/_gate_${slug}.json`;
  fs.writeFileSync(tmp, JSON.stringify(draft));
  let reasons = [];
  const run = (name, cmd) => { try { execSync(cmd, { stdio: "pipe" }); } catch (e) { reasons.push(name); } };
  run("validate", `node scripts/validate-article.js "${slug}" "${tmp}"`);
  run("human-feel", `node scripts/human-feel.js "${slug}" "${tmp}"`);
  run("score", `node scripts/score-article.js "${slug}" "${tmp}"`);
  // crosssim: 인덱스 없으면 스크립트가 skip(0) 처리
  run("crosssim", `node scripts/verify-crosssim.js "${slug}" "${tmp}"`);
  // B20 인라인
  const b20 = b20TitleIntroMatch(draft);
  if (b20.length) { reasons.push("B20"); console.log(`   ${it}: ${b20.join(" / ")}`); }
  // judge: CLI 없으면 exit 2 → 경고 스킵 (사람이 대신 검토해야 함)
  // 2026-07-19 신설 — judge PASS 캐시: 같은 내용(해시 동일)이 이미 통과했으면 재채점 생략.
  //   실측 근거: 비모보정30정이 동일 내용으로 82점 PASS → 1시간 뒤 재채점에서 79점 FAIL (LLM 채점 요동).
  //   경계선 글이 배포마다 복불복 차단되는 결함 + 통과분 재채점은 토큰 낭비. 내용이 바뀌면 해시가 달라져 자동 재채점.
  const CACHE_FILE = "_workspace/judge-cache.json";
  let judgeCache = {}; try { judgeCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch {}
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(draft)).digest("hex").slice(0, 16);
  const cached = judgeCache[slug];
  if (cached && cached.hash === contentHash && cached.pass) {
    console.log(`   ${it}: judge 캐시 PASS (${cached.date} 통과분과 동일 내용 — 재채점 생략)`);
  } else {
    try {
      execSync(`node scripts/satisfaction-judge.js "${slug}" "${tmp}"`, { stdio: "pipe" });
      judgeCache[slug] = { hash: contentHash, pass: true, date: new Date().toISOString().slice(0, 10) };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(judgeCache, null, 1));
    }
    catch (e) { if (e.status === 1) reasons.push("judge<80점"); else judgeSkipped++; }
  }
  try { fs.unlinkSync(tmp); } catch {}
  if (reasons.length) { console.log(`❌ ${it} 품질 FAIL (${reasons.join(", ")})`); failed.push(it); }
  else console.log(`✅ ${it} 품질 통과`);
}
if (judgeSkipped) console.log(`⚠️  만족심판(judge) ${judgeSkipped}편 스킵 — claude CLI 미가용. 배포 전 사람 검토 필요.`);
if (failed.length) {
  console.error(`\n🚫 푸시 차단 — 품질 미달 ${failed.length}편: ${failed.join(", ")}`);
  console.error("   해당 글 수정 후 다시 푸시하세요. (미달 글은 라이브에 올라가지 않음)");
  process.exit(1);
}
console.log("✅ 전체 품질 통과 — 배포 진행");
