#!/usr/bin/env node
/** check-article.js — 글 검사기 (새 시스템의 유일한 품질 게이트, 2026-10-20)
 *
 *  규칙 = 운영자 원칙 그대로. 하나라도 걸리면 FAIL → 고쳐서 다시.
 *   R1 타이틀은 제품명으로 시작
 *   R2 타이틀에 "가격" 또는 "최저가"
 *   R3 타이틀 스펙 나열 금지 (성분·효과·복용법·부작용… 3종 이상)
 *   R4 타이틀 키워드가 전부 소제목에 있다 (타이틀 = 소제목)
 *   R5 소제목 3~6개 (글자수·개수는 목표가 아님 — 타이틀 질문만큼)
 *   R6 본문에 가격 단정 금지 ("25,000원", "21,000원부터" 등 — 약국마다 다르다)
 *   R7 ~해요체 통일 (~합니다/~습니다 금지)
 *   R8 금지 문구 (버튼 지시·못 지키는 약속·찍어내기 서론)
 *   R9 숫자는 근거 파일에 있는 것만 (+ draft.calc 에 적은 계산식의 결과)
 *
 *  사용:
 *   node scripts/check-article.js {카테고리/슬러그} {draft.json} [--facts 근거파일]
 *     근거파일 기본값: source-data/{슬러그}.json (식약처 원문). 없으면 R9 FAIL = 근거 없이 작성 금지.
 *   node scripts/check-article.js --calibrate   # 기준 글 PASS / 레거시 나열형 FAIL 재확인 (public/data 필요)
 *  종료코드: PASS 0 / FAIL 1 / 사용법 오류 2
 */
const fs = require("fs");
const path = require("path");

const SPEC = /(성분|효능|효과|복용법|사용법|용법|용량|부작용|주의사항|보관)/g;
const BANNED = ["아래 버튼에서", "실시간", "핵심부터 말하면", "결론부터 말하면", "정리했어요", "정리했습니다", "솔직히", "—"];
const PARTICLE = /(과|와|은|는|이|가|을|를|의|도|까지|부터|에서|으로|로|이에요|예요|인가요|일까요|할까요|나요|는\?|\?)+$/;
const STOP = new Set(["얼마", "어떻게", "언제", "무엇", "뭐", "왜", "정말", "그리고"]);

const norm = (t) => String(t || "").replace(/\s+/g, "");
const nameOf = (slug, d) => d.product || slug.split("/").pop();
const bodyOf = (d) => [d.heroDescription, ...(d.sections || []).map((s) => s.content), ...(d.faq || []).map((f) => f.question + " " + f.answer)].join("\n");

function titleKeywords(title, name) {
  let t = String(title);
  const n = norm(name);
  // 제품명(띄어쓰기·% 차이 허용) 제거
  let acc = "", cut = 0;
  for (let i = 0; i < t.length && norm(acc).length < n.length; i++) { acc += t[i]; cut = i + 1; }
  t = t.slice(cut).replace(/^%/, "");
  return t.split(/[\s,?·|]+/).map((w) => w.replace(PARTICLE, "")).filter((w) => (w.length >= 2 || /\d/.test(w)) && !STOP.has(w));
}

function numbersIn(text) {
  return (String(text).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((x) => x.replace(/,/g, ""));
}

function check(slug, d, factsText) {
  const fails = [];
  const name = nameOf(slug, d);
  const title = String(d.title || "");
  const h2 = (d.sections || []).map((s) => s.title || "");
  const body = bodyOf(d);

  if (!norm(title).startsWith(norm(name))) fails.push(`R1 타이틀이 제품명("${name}")으로 시작하지 않음`);
  if (!/가격|최저가/.test(title)) fails.push(`R2 타이틀에 "가격" 또는 "최저가" 없음`);
  const spec = new Set(title.match(SPEC) || []);
  if (spec.size >= 3) fails.push(`R3 타이틀 스펙 나열 (${[...spec].join("·")}) — 독자 질문으로`);
  const miss = titleKeywords(title, name).filter((k) => !h2.some((h) => h.includes(k)));
  if (miss.length) fails.push(`R4 타이틀 키워드가 소제목에 없음: ${miss.join(", ")} — 타이틀이 약속한 질문마다 소제목 1개`);
  if (h2.length < 3 || h2.length > 6) fails.push(`R5 소제목 ${h2.length}개 — 타이틀 질문만큼 3~6개`);
  const won = body.match(/\d[\d,]*\s*원/g);
  if (won) fails.push(`R6 가격 단정 ${won.slice(0, 3).join(", ")} — 약국마다 다르다. 병 수·비교 기준으로 쓰고 "최저가를 확인해 보시면 돼요"로`);
  const formal = body.match(/[가-힣]*(합니다|습니다|됩니다)(?=[.\s]|$)/g);
  if (formal) fails.push(`R7 ~합니다체 ${formal.slice(0, 3).join(", ")} — ~해요체로 통일`);
  const banned = BANNED.filter((b) => (title + "\n" + body).includes(b));
  if (banned.length) fails.push(`R8 금지 문구: ${banned.join(", ")}`);

  if (factsText === null) fails.push(`R9 근거 파일 없음 — 식약처 원문(source-data/${slug.split("/").pop()}.json) 없이 작성 금지`);
  else {
    const facts = new Set(numbersIn(factsText));
    const derived = new Set();
    for (const c of d.calc || []) { // 예: "1.3*120=156"
      const m = String(c).replace(/\s/g, "").match(/^([\d.*/+\-()]+)=([\d.]+)$/);
      if (!m) { fails.push(`R9 계산식 형식 오류: ${c} (예: 1.3*120=156)`); continue; }
      const ops = numbersIn(m[1]);
      const bad = ops.filter((o) => !facts.has(o) && !["30", "120", "4"].includes(o)); // 한 달 30일·넉 달 120일·4개월 환산만 허용
      // eslint-disable-next-line no-new-func
      const val = Function(`return (${m[1]})`)();
      if (bad.length) fails.push(`R9 계산식 ${c}: 근거 없는 수 ${bad.join(",")}`);
      else if (Math.abs(val - Number(m[2])) > 1e-6) fails.push(`R9 계산 틀림: ${c} (실제 ${val})`);
      else derived.add(m[2]);
    }
    const unknown = [...new Set(numbersIn(body + " " + title))].filter((n) => !facts.has(n) && !derived.has(n));
    if (unknown.length) fails.push(`R9 근거 없는 숫자: ${unknown.join(", ")} — 근거 파일에 있거나 calc 에 계산식으로 적은 숫자만`);
  }
  return fails;
}

const args = process.argv.slice(2);
if (args[0] === "--calibrate") {
  // 구조 규칙(R1~R8) 대조. R9는 글마다 근거 파일이 달라 여기선 제외.
  const GOOD = ["탈모/판시딜액3"]; // 운영자 승인 기준 글 — 승인될 때마다 추가
  const root = path.join("public", "data");
  if (!fs.existsSync(root)) { console.error("public/data 없음 — node scripts/generate-article-json.mjs 먼저"); process.exit(2); }
  const load = (k) => JSON.parse(fs.readFileSync(path.join(root, k + ".json"), "utf8"));
  const struct = (k, d) => check(k, d, "").filter((f) => !f.startsWith("R9"));
  const g = GOOD.filter((k) => fs.existsSync(path.join(root, k + ".json"))).map((k) => [k, struct(k, load(k))]);
  const bad = [];
  for (const c of fs.readdirSync(root)) {
    const dir = path.join(root, c);
    if (!fs.statSync(dir).isDirectory() || c === "유산균") continue;
    for (const f of fs.readdirSync(dir)) { const d = load(c + "/" + f.slice(0, -5)); if (String(d.title).includes("|")) bad.push([c + "/" + f.slice(0, -5), struct(c, d)]); }
  }
  const gFail = g.filter(([, r]) => r.length), bPass = bad.filter(([, r]) => !r.length);
  console.log(`기준 글 ${g.length}/${GOOD.length}편 — FAIL ${gFail.length} ${gFail.map(([k, r]) => k + ":" + r[0]).join(" / ")}`);
  console.log(`레거시 나열형 ${bad.length}편 — 놓침(PASS) ${bPass.length} ${bPass.slice(0, 5).map(([k]) => k).join(", ")}`);
  const ok = g.length === GOOD.length && !gFail.length && !bPass.length;
  console.log(ok ? "CALIBRATION OK" : "CALIBRATION BROKEN");
  process.exit(ok ? 0 : 1);
}
const [slug, draftPath] = args;
if (!slug || !draftPath || !slug.includes("/")) { console.error("usage: node scripts/check-article.js {카테고리/슬러그} {draft.json} [--facts 파일] | --calibrate"); process.exit(2); }
const fi = args.indexOf("--facts");
const factsPath = fi > -1 ? args[fi + 1] : path.join("source-data", slug.split("/").pop() + ".json");
const factsText = fs.existsSync(factsPath) ? fs.readFileSync(factsPath, "utf8") : null;
const d = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const fails = check(slug, d, factsText);
if (fails.length) { console.log(`CHECK FAIL ${slug}\n- ` + fails.join("\n- ")); process.exit(1); }
console.log(`CHECK PASS ${slug} (소제목 ${d.sections.length}개)`);
