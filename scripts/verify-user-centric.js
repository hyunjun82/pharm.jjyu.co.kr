#!/usr/bin/env node
/** verify-user-centric.js — "사용자 중심 구조" 게이트 (2026-10-20 신설)
 *
 *  배경 (실측 2026-10-20, public/data 3,107편 전수):
 *   - 레거시 글은 타이틀 "{X} 최저가 가격 | 성분 효과 복용법 부작용까지", H2 "성분은 무엇인가요/효과/복용법/부작용/주의사항/보관"
 *     → 스펙 나열에 물음표만 붙인 구조. 독자의 결정 질문(나한테 맞나·뭘 사나·같이 써도 되나)이 없음.
 *   - 기존 검증기 26규칙·채점 10지표는 전부 길이·숫자·어미 같은 기계 지표라 이 구조를 못 잡음.
 *   - 원인 하나: prompts/writer-spoke.md 규칙 2가 [어떤 약][복용법][가격][부작용][금기] 스펙 순서를 강제하고 있었음.
 *
 *  규칙 (하드 — 하나라도 걸리면 FAIL):
 *   U1 나열형 타이틀: 타이틀에 스펙 단어(성분·효과·효능·복용법·사용법·용법·용량·부작용·주의사항·보관)가 3종 이상
 *   U2 스펙형 H2 과다: "성분은 무엇인가요/부작용 주의사항/어떤 약이에요"류 H2 비율이 maxSpecRatio 이상
 *   U3 결정 질문 부족: 독자의 결정·비교·행동 질문 H2가 minDecision개 미만
 *   U4 타이틀 틀 복제: 같은 카테고리 라이브 글과 타이틀 틀(제품명→{X}, 숫자→N)이 완전히 같음
 *  보고 전용 (차단 안 함 — 아직 정답 세트로 보정 못 함):
 *   R1 실측 검색어 반영: _workspace/intent/{slug}.json 의 실제 검색어 의도가 H2에 몇 개 들어갔나
 *   R2 리드 질문 쏠림: 같은 카테고리에서 타이틀 앞머리("{X} 가격 얼마?")가 같은 글 수
 *
 *  보정 (원칙 0-3·0-4, 2026-10-20 실측 — node scripts/verify-user-centric.js --calibrate 로 재현):
 *   정답 15편(8월 리라이트 + 기준본 미녹시딜): 타이틀 스펙 단어 최대 0 / 스펙형 H2 비율 최대 0.08 / 결정 H2 최소 4 → 15/15 PASS
 *   오답 647편(파이프 나열형 레거시, 유산균 제외): 스펙 단어 중앙값 4 / 스펙형 비율 중앙값 0.67 / 결정 H2 최대 2 → 647/647 FAIL
 *
 *  사용:
 *    node scripts/verify-user-centric.js {slug} {draft.json}   # 게이트 (auto-batch·pre-deploy-gate)
 *    node scripts/verify-user-centric.js --calibrate           # 정답/오답 세트 분리 재검증 (public/data 필요 → npm run build 1회 또는 node scripts/generate-article-json.mjs)
 *    node scripts/verify-user-centric.js --audit [카테고리]     # 라이브 데이터 전수 → _workspace/user-centric-audit.json (리라이트 큐 근거)
 *  종료코드: PASS 0 / FAIL 1 / 사용법 오류 2
 */
const fs = require("fs");
const path = require("path");

const DEF = {
  maxSpecTitleWords: 2, // 3종 이상이면 나열형 (정답 최대 0, 오답 중앙값 4)
  maxSpecRatio: 0.34,   // 정답 최대 0.08, 오답 중앙값 0.67
  minDecision: 3,       // 정답 최소 4, 오답 최대 2
};
// 정답 세트 = 2026-08 리라이트 + 기준본. 기준을 바꾸면 --calibrate 로 이 15편이 전부 PASS인지 먼저 확인할 것.
const GOOD_SET = ["탈모/미녹시딜", "탈모/동성미녹시딜3", "탈모/두보트정", "탈모/두타겟정", "탈모/로게인", "탈모/마이녹실액3",
  "탈모/메리나30", "탈모/미노페시아", "탈모/아보다트", "탈모/카필러스", "탈모/케라민캡슐", "탈모/판시딜", "탈모/판시딜액",
  "탈모/프로페시아", "탈모/헤어그로"];

const SPEC = "(성분|효능효과|효능·효과|효과|효능|복용법|사용법|용법|용량|부작용|주의사항|주의할 점|보관 방법|보관법|보관)";
const SPEC_RE = new RegExp(SPEC, "g");
const SPEC_H2 = new RegExp("^(?:[^\\s,]+[\\s,]*)?(?:의\\s*)?(?:주요\\s*)?" + SPEC + "(?:과|와|및|·|,|\\s)*" + SPEC +
  "?(?:은|는|이|가|을|를)?\\s*(?:무엇인가요|무엇이에요|뭔가요|뭐예요|어떻게 되나요|어떤 게 있나요|어떤 것이 있나요|있나요|확인하세요|정리|총정리|알아보기)?\\s*\\??$");
const WHAT_H2 = /(어떤 약|무엇인가요|이란\?|란\?)/;
// 결정·비교·행동 질문 신호. 단어를 끼워 넣어 통과시키지 말 것 — 템플릿 §3 의 질문이 실제로 답돼야 한다(judge·육안이 최종선).
const DECISION = /(나한테|저도|해당|골라|고르|선택|손해|vs|VS|차이|다른가|달라요|다른 점|뭐가 달|뭐가 더|같이 (써|먹|발라)|함께 (써|먹)|대신|그래서|오늘 뭐|써도 되|먹어도 되|발라도 되|돼요\?|되나요\?|될까|괜찮|굳이|유리|아껴|얼마나 들|총비용|언제부터|중단|끊으면|어디쯤|살 수 있)/;

function metrics(d) {
  const h2 = (d.sections || []).map((s) => String(s.title || "").trim());
  const specTitle = new Set(String(d.title || "").match(SPEC_RE) || []).size;
  const spec = h2.filter((x) => SPEC_H2.test(x) || WHAT_H2.test(x));
  const dec = h2.filter((x) => DECISION.test(x));
  return { specTitle, n: h2.length, specH2: spec, specRatio: h2.length ? spec.length / h2.length : 1, decH2: dec };
}

function skeleton(title) {
  const t = String(title || "");
  const head = t.split(/[\s,?]/)[0];
  return t.replace(head, "{X}").replace(/[0-9][0-9,.]*/g, "N");
}
function leadOf(sk) { return sk.split(/[?,|]/)[0]; }

// auto-batch·pre-deploy-gate는 카테고리 없는 slug를 넘기고, writer 초안 JSON엔 categorySlug가 없다 → 브리프 cat → public/data 순으로 찾는다
function categoryOf(slug, bare, d) {
  if (slug.includes("/")) return slug.split("/")[0];
  if (d.categorySlug) return d.categorySlug;
  try { const b = JSON.parse(fs.readFileSync(path.join("_workspace", "briefs", bare + ".json"), "utf8")); if (b.cat) return b.cat; } catch {}
  const root = path.join("public", "data");
  if (fs.existsSync(root)) for (const c of fs.readdirSync(root)) if (fs.existsSync(path.join(root, c, bare + ".json"))) return c;
  return null;
}

function liveCategory(cat, exceptSlug) {
  const dir = path.join("public", "data", cat);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== exceptSlug + ".json")
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } })
    .filter(Boolean);
}

function check(slug, d) {
  const m = metrics(d);
  const hard = [], report = [];
  if (m.specTitle > DEF.maxSpecTitleWords)
    hard.push(`U1 나열형 타이틀: 스펙 단어 ${m.specTitle}종("${d.title}") — 독자의 1위 질문 하나 + 이 제품만의 답으로 다시 써라 (템플릿 §4)`);
  if (m.specRatio >= DEF.maxSpecRatio)
    hard.push(`U2 스펙형 H2 ${m.specH2.length}/${m.n}개: ${m.specH2.slice(0, 4).join(" / ")} — 스펙 이름이 아니라 독자가 묻는 질문으로 (템플릿 §3)`);
  if (m.decH2.length < DEF.minDecision)
    hard.push(`U3 결정 질문 H2 ${m.decH2.length}개 < ${DEF.minDecision}: '나한테 맞나·뭘 골라야·같이 써도 되나·언제부터·중단하면' 같은 결정 질문이 없다 (템플릿 §3 필수 블록)`);

  const bare = slug.includes("/") ? slug.split("/")[1] : slug;
  const cat = categoryOf(slug, bare, d);
  const live = cat ? liveCategory(cat, bare) : null;
  if (live === null) report.push(`U4 건너뜀: ${cat ? "public/data 없음 (node scripts/generate-article-json.mjs 후 재검사)" : "카테고리 판별 불가"}`);
  else {
    const sk = skeleton(d.title);
    const twins = live.filter((x) => skeleton(x.title) === sk).map((x) => x.slug);
    if (twins.length) hard.push(`U4 타이틀 틀 복제: "${sk}" 가 같은 카테고리 ${twins.length}편과 동일 (${twins.slice(0, 3).join(", ")}) — 제품 고유 답으로 바꿔라`);
    const lead = leadOf(sk);
    const sameLead = live.filter((x) => leadOf(skeleton(x.title)) === lead).length;
    if (sameLead >= 5) report.push(`R2 리드 질문 쏠림(보고): 앞머리 "${lead}" 가 같은 카테고리에 ${sameLead}편 — 실측 1위 검색어로 리드 질문을 고를 것 (템플릿 §4)`);
  }

  const intentFile = path.join("_workspace", "intent", bare + ".json");
  if (fs.existsSync(intentFile)) {
    try {
      const qs = (JSON.parse(fs.readFileSync(intentFile, "utf8")).userQuestions || []);
      const tails = [...new Set(qs.map((q) => q.replace(bare, "").trim()).filter((q) => q.length >= 2))];
      const body = (d.sections || []).map((s) => s.title + " " + s.content).join(" ") + " " + (d.faq || []).map((f) => f.question).join(" ");
      const hit = tails.filter((t) => t.split(/\s+/).every((w) => body.includes(w)));
      report.push(`R1 실측 검색어 반영(보고): ${hit.length}/${tails.length} — 누락 예: ${tails.filter((t) => !hit.includes(t)).slice(0, 5).join(", ") || "없음"}`);
    } catch { /* intent 파일 손상 — 보고 생략 */ }
  } else report.push(`R1 건너뜀: ${intentFile} 없음 — 작성 전에 node scripts/intent-harvest.mjs ${bare} 실행 권장 (템플릿 §1)`);
  return { m, hard, report };
}

function allLive() {
  const root = path.join("public", "data");
  if (!fs.existsSync(root)) { console.error("public/data 없음 — node scripts/generate-article-json.mjs 먼저 실행"); process.exit(2); }
  const out = [];
  for (const cat of fs.readdirSync(root)) {
    const dir = path.join(root, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try { out.push({ key: cat + "/" + f.slice(0, -5), d: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }); } catch {}
    }
  }
  return out;
}
const structFail = (m) => m.specTitle > DEF.maxSpecTitleWords || m.specRatio >= DEF.maxSpecRatio || m.decH2.length < DEF.minDecision;

const [a1, a2] = process.argv.slice(2);
if (a1 === "--calibrate") {
  // U1~U3만 대조 (U4는 글 사이 관계라 세트 분리 지표가 아님)
  const all = allLive();
  const good = all.filter((x) => GOOD_SET.includes(x.key));
  const bad = all.filter((x) => String(x.d.title).includes("|") && x.d.categorySlug !== "유산균");
  const gFail = good.filter((x) => structFail(metrics(x.d)));
  const bPass = bad.filter((x) => !structFail(metrics(x.d)));
  console.log(`정답 세트 ${good.length}/${GOOD_SET.length}편 로드 — FAIL ${gFail.length}편 ${gFail.map((x) => x.key).join(", ")}`);
  console.log(`오답 세트(파이프 나열형 레거시) ${bad.length}편 — 놓침(PASS) ${bPass.length}편 ${bPass.slice(0, 5).map((x) => x.key).join(", ")}`);
  const ok = good.length === GOOD_SET.length && gFail.length === 0 && bPass.length === 0;
  console.log(ok ? "CALIBRATION OK" : "CALIBRATION BROKEN — 기준 변경을 롤백하거나 다시 보정하라 (CLAUDE.md 원칙 0-3)");
  process.exit(ok ? 0 : 1);
}
if (a1 === "--audit") {
  const all = allLive().filter((x) => !a2 || x.key.startsWith(a2 + "/"));
  const rows = all.map((x) => { const m = metrics(x.d); return { key: x.key, fail: structFail(m), specTitle: m.specTitle, specRatio: +m.specRatio.toFixed(2), decision: m.decH2.length, title: x.d.title }; });
  fs.mkdirSync("_workspace", { recursive: true });
  fs.writeFileSync(path.join("_workspace", "user-centric-audit.json"), JSON.stringify(rows, null, 1));
  const byCat = {};
  rows.forEach((r) => { const c = r.key.split("/")[0]; byCat[c] = byCat[c] || [0, 0]; byCat[c][0]++; if (r.fail) byCat[c][1]++; });
  console.log(`전수 ${rows.length}편 중 사용자중심 구조 미달 ${rows.filter((r) => r.fail).length}편 → _workspace/user-centric-audit.json`);
  Object.entries(byCat).sort((x, y) => y[1][1] - x[1][1]).forEach(([c, [n, f]]) => console.log(`  ${c}: ${f}/${n}`));
  process.exit(0);
}
if (!a1 || !a2) { console.error("usage: node scripts/verify-user-centric.js {slug} {draft.json} | --calibrate | --audit [카테고리]"); process.exit(2); }
const d = JSON.parse(fs.readFileSync(a2, "utf8"));
const r = check(a1, d);
r.report.forEach((x) => console.log("  · " + x));
if (r.hard.length) { console.log("USER-CENTRIC FAIL. fix:\n- " + r.hard.join("\n- ")); process.exit(1); }
console.log(`USER-CENTRIC PASS (스펙단어 ${r.m.specTitle} / 스펙형H2 ${r.m.specH2.length}/${r.m.n} / 결정H2 ${r.m.decH2.length})`);
