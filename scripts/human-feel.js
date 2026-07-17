#!/usr/bin/env node
/** human-feel.js — "사람이 쓴 글 vs AI 찍어내기" 게이트 (검증기·채점기 보완)
 *
 *  배경: 라이브 실측(2026-06-17) 탈모 214편 측정에서 'AI 지문 클러스터' 발견.
 *   - 표준 글(아보다트·미녹시딜·프로페시아): 문장길이 변동계수(cv) 0.44~0.56, 헤지밀도 1~2.5/1k, 출처밀도 4~8/1k
 *   - 찍어내기 클러스터(헤르겐스칼프액2·넥스모액2·모바린액2 …): cv 0.31~0.38 + 헤지 4~6/1k + 출처 0~0.5/1k 가 수십 편 통계적으로 동일
 *     → 길이·구조·어휘가 사실상 복제된 도어웨이. 구글이 "크롤링됨·색인 안 됨"으로 버리는 정확한 유형.
 *
 *  사용:
 *    node scripts/human-feel.js {slug} {draft.json}     # 파이프라인 게이트 (validate/score 뒤)
 *    node scripts/human-feel.js --audit [카테고리접두]    # data/articles 전수 진단 -> _workspace/humanfeel-audit.json
 *
 *  종료코드: 게이트 모드에서 하드 FAIL이면 1 (auto-batch가 반려·재작성에 사용)
 */
const fs = require("fs");
const path = require("path");

// ---- 임계값 (위 실측으로 보정. quality-config.json humanFeel 블록으로 덮어쓰기 가능) ----
const DEF = {
  minSentenceCV: 0.40,        // 문장길이 변동계수 하한 (표준 중앙값 0.47). 낮으면 = 같은 길이 문장 반복 = 로봇
  maxHedgePer1k: 4.0,         // '~수 있어요/가능성이 있어요' 과잉 = 책임회피형 기계 문체
  minAuthorityPer1k: 1.5,     // 공식 출처 인용 하한. 0이면 E-E-A-T 부재 -> 색인 탈락
  maxAuthorityPer1k: 9.0,     // 상한. 매 문장 '식약처 허가사항' = 규정문서 단조 (사람 글 아님)
  minParaOpenDiversity: 0.6,  // 문단 첫 6글자 고유비율. 낮으면 '식약처 허가사항은...' 복붙 시작
  minLivedDetail: 1,          // 생활밀착 2인칭 디테일 최소 횟수 (사람 글의 핵심 신호)
  enforceLivedDetail: false,  // 기본 false: 표준 글도 아직 미충족이라 '경고'로만. 코퍼스 상향 후 true 전환 (기준 상향 후보)
  metricTwinThreshold: 4,     // 같은 카테고리에 지표 지문이 동일한 글이 이 수 이상이면 복제 양산
};
// 하드 게이트(색인·AI지문에 직결, 표준 글은 통과) 규칙 이름
const HARD_RULES = ["AI지문", "과잉 헤지", "출처 부재", "규정문서 단조", "복제 양산"];

// 생활밀착·2인칭 실사용 디테일 신호 (사람이 직접 써본 듯한 구체 행동/감각 묘사)
const LIVED = [
  /흘러내리/, /덜 ?마른/, /끈적/, /따가/, /가려우면/, /베개/, /옷에 ?묻/, /손에 ?묻/,
  /냄새/, /자기 ?전/, /아침에 ?일어/, /감고 ?나서/, /말리고/, /드라이/, /두피가 ?당기/,
  /바르고 ?나면/, /먹고 ?나면/, /삼키기/, /목에 ?걸/, /물 ?없이/, /빈속/, /식후 ?바로/,
  /깜빡/, /거르면/, /놓치면/, /한 ?알씩/, /반으로 ?쪼/, /챙기기 ?어려/, /손이 ?잘 ?안/,
];
const HEDGE = /수 ?있어요|수 ?있는|가능성이 ?있|할 ?수 ?있|될 ?수 ?있|있을 ?수 ?있|수도 ?있/g;
const AUTH = /식약처|허가사항|허가 ?기준|허가받|e약은요|품목번호|신고번호|허가 ?문서|식품안전나라/g;

function bodyOf(d) {
  return [d.heroDescription, ...(d.sections || []).map((s) => s.content || ""), ...(d.faq || []).map((f) => f.answer || "")].join(" ");
}

function metrics(d) {
  const secs = (d.sections || []).map((s) => s.content || "");
  const body = bodyOf(d);
  const L = Math.max(body.length, 1);
  const sents = body.split(/(?<=[.!?])\s+/).filter((x) => x.length > 3).map((x) => x.length);
  const mean = sents.reduce((a, b) => a + b, 0) / Math.max(sents.length, 1);
  const sd = Math.sqrt(sents.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(sents.length, 1));
  const cv = +(sd / Math.max(mean, 1)).toFixed(3);
  const hedge = (body.match(HEDGE) || []).length;
  const auth = (body.match(AUTH) || []).length;
  const paras = [];
  for (const c of secs) for (const p of c.split(/\n\n+/)) if (p.trim().length > 10) paras.push(p.trim().slice(0, 6));
  const paraDiv = paras.length ? +(new Set(paras).size / paras.length).toFixed(2) : 1;
  const lived = LIVED.reduce((n, re) => n + (re.test(body) ? 1 : 0), 0);
  return { chars: L, sentCV: cv, hedgePer1k: +((hedge / L) * 1000).toFixed(2), authPer1k: +((auth / L) * 1000).toFixed(2), paraOpenDiversity: paraDiv, livedDetail: lived };
}

// 반환: { hard:[...], soft:[...] }. hard만 종료코드 1을 유발.
function judge(m, cfg) {
  const hard = [], soft = [];
  if (m.sentCV < cfg.minSentenceCV) hard.push("AI지문: 문장길이 변동계수 " + m.sentCV + " < " + cfg.minSentenceCV + " (문장이 다 비슷한 길이 = 로봇 리듬. 짧은 문장·긴 문장 섞기)");
  if (m.hedgePer1k > cfg.maxHedgePer1k) hard.push("과잉 헤지: '수 있어요'류 " + m.hedgePer1k + "/1k > " + cfg.maxHedgePer1k + " (단정할 건 단정하고 책임회피 어투 줄이기)");
  if (m.authPer1k < cfg.minAuthorityPer1k) hard.push("출처 부재: 공식 출처 인용 " + m.authPer1k + "/1k < " + cfg.minAuthorityPer1k + " (E-E-A-T 부족 -> 색인 탈락. 품목번호·허가사항 근거 보강)");
  if (m.authPer1k > cfg.maxAuthorityPer1k) hard.push("규정문서 단조: 출처어 " + m.authPer1k + "/1k > " + cfg.maxAuthorityPer1k + " (매 문장 '식약처 허가사항' 반복 = AI 느낌. 답부터 쓰고 출처는 한 번만)");
  if (m.paraOpenDiversity < cfg.minParaOpenDiversity) soft.push("복붙 시작: 문단 첫머리 다양성 " + m.paraOpenDiversity + " < " + cfg.minParaOpenDiversity + " (여러 문단이 같은 구절로 시작)");
  if (m.livedDetail < cfg.minLivedDetail) (cfg.enforceLivedDetail ? hard : soft).push("생활 디테일 0: 실제 써본 듯한 구체 묘사(흘러내림·덜 마른 두피·물 없이 삼키기 등)가 없음 — 사람 글의 결정적 신호. 섹션마다 1개 이상");
  return { hard, soft };
}

function loadCfg() {
  try {
    const q = JSON.parse(fs.readFileSync(path.join(__dirname, "quality-config.json"), "utf8"));
    return { ...DEF, ...(q.humanFeel || {}) };
  } catch (e) { return DEF; }
}

// ---- .ts에서 slug별 draft 유사 객체 추출 (audit 모드용) ----
function draftsFromTs(file) {
  const s = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /slug:\s*"([^"]+)",\s*\n\s*categorySlug:\s*"([^"]+)"/g;
  let m;
  const idxs = [];
  while ((m = re.exec(s))) idxs.push({ slug: m[1], cat: m[2], at: m.index });
  for (let i = 0; i < idxs.length; i++) {
    const block = s.slice(idxs[i].at, i + 1 < idxs.length ? idxs[i + 1].at : s.length);
    const hero = (block.match(/heroDescription:\s*\n?\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || "";
    const sections = [...block.matchAll(/title:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*content:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => ({ title: x[1].replace(/\\n/g, "\n"), content: x[2].replace(/\\n/g, "\n") }));
    const faq = [...block.matchAll(/answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => ({ answer: x[1].replace(/\\n/g, "\n") }));
    if (sections.length || hero) out.push({ slug: idxs[i].slug, cat: idxs[i].cat, heroDescription: hero.replace(/\\n/g, "\n"), sections, faq });
  }
  return out;
}

const cfg = loadCfg();

if (process.argv[2] === "--audit") {
  const pref = process.argv[3] || "";
  const dir = "data/articles";
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    if (pref && !file.startsWith(pref)) continue;
    let drafts = [];
    try { drafts = draftsFromTs(path.join(dir, file)); } catch (e) { continue; }
    for (const d of drafts) {
      const body = bodyOf(d);
      if (body.length < 800) continue;
      const m = metrics(d);
      const j = judge(m, cfg);
      rows.push({ slug: d.slug, cat: d.cat, file, ...m, hard: j.hard, soft: j.soft });
    }
  }
  // 지표 지문 쌍둥이 탐지: 같은 카테고리에서 (cv,hedge,auth,chars) 가 거의 동일한 글 군집 = 복제 양산
  const sig = (r) => Math.round(r.sentCV * 20) + "_" + Math.round(r.hedgePer1k) + "_" + Math.round(r.authPer1k) + "_" + Math.round(r.chars / 100);
  const byCat = {};
  rows.forEach((r) => { byCat[r.cat] = byCat[r.cat] || {}; byCat[r.cat][sig(r)] = (byCat[r.cat][sig(r)] || 0) + 1; });
  rows.forEach((r) => { r.metricTwins = byCat[r.cat][sig(r)] - 1; if (r.metricTwins >= cfg.metricTwinThreshold) r.hard.push("복제 양산 의심: 같은 카테고리에 지표 지문이 사실상 동일한 글 " + r.metricTwins + "편 (도어웨이 위험)"); });
  rows.forEach((r) => { r.hardCount = r.hard.length; r.softCount = r.soft.length; });

  const failing = rows.filter((r) => r.hardCount > 0).sort((a, b) => b.hardCount - a.hardCount || a.sentCV - b.sentCV);
  const ALLRULES = ["AI지문", "과잉 헤지", "출처 부재", "규정문서 단조", "복제 양산", "복붙 시작", "생활 디테일"];
  const summary = { measured: rows.length, hardFail: failing.length, hardFailRate: rows.length ? +((failing.length / rows.length) * 100).toFixed(1) : 0, byRule: {}, medians: {}, note: "hardFail만 발행 차단 대상. 소프트(복붙 시작·생활 디테일)는 품질 상향 권고." };
  ALLRULES.forEach((k) => { summary.byRule[k] = rows.filter((r) => [...r.hard, ...r.soft].some((f) => f.indexOf(k) === 0)).length; });
  ["sentCV", "hedgePer1k", "authPer1k", "paraOpenDiversity", "livedDetail"].forEach((k) => { const v = rows.map((r) => r[k]).sort((a, b) => a - b); summary.medians[k] = v.length ? v[Math.floor(v.length / 2)] : null; });
  fs.mkdirSync("_workspace", { recursive: true });
  fs.writeFileSync("_workspace/humanfeel-audit.json", JSON.stringify({ summary, failing }, null, 1));
  console.log("=== human-feel audit (hard gate = block publish) ===");
  console.log(JSON.stringify(summary, null, 1));
  console.log("\n detail: _workspace/humanfeel-audit.json (hard-fail " + failing.length + ")");
  console.log("\n--- hard-fail worst 12 (rewrite priority) ---");
  failing.slice(0, 12).forEach((r) => console.log(" - [" + r.cat + "] " + r.slug + "  cv=" + r.sentCV + " hedge=" + r.hedgePer1k + " auth=" + r.authPer1k + " twins=" + r.metricTwins + "  / hard " + r.hardCount));
  process.exit(0);
}

// ---- gate mode ----
const [slug, draftFile] = process.argv.slice(2);
if (!slug || !draftFile) { console.error("usage: node scripts/human-feel.js {slug} {draft.json}  OR  --audit [prefix]"); process.exit(2); }
const d = JSON.parse(fs.readFileSync(draftFile, "utf8"));
const m = metrics(d);
const j = judge(m, cfg);
console.log("[" + slug + "] human-feel:", JSON.stringify(m));
if (j.soft.length) console.log("soft warnings:\n- " + j.soft.join("\n- "));
if (j.hard.length) { console.log("HUMAN-FEEL FAIL (AI feel / index risk). fix:\n- " + j.hard.join("\n- ")); process.exit(1); }
console.log("HUMAN-FEEL PASS");
