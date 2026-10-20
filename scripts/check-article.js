#!/usr/bin/env node
/** check-article.js — 글 검사기 (새 시스템의 유일한 품질 게이트, 2026-10-20)
 *
 *  규칙 = 운영자 원칙 그대로. 하나라도 걸리면 FAIL → 고쳐서 다시.
 *   R1 타이틀은 제품명으로 시작
 *   R2 타이틀에 "가격" 또는 "최저가"
 *   R3 타이틀 스펙 나열 금지 (성분·효과·복용법·부작용… 3종 이상)
 *   R4 타이틀 키워드가 전부 소제목에 있다 (타이틀 = 소제목)
 *   R5 소제목 3~6개 (글자수·개수는 목표가 아님 — 타이틀 질문만큼)
 *   R6 가격엔 출처·시점 ("약국 가격비교 서비스… (2026년 7월 기준)"), "온라인" 표현 금지 (일반의약품은 온라인 판매 불가)
 *   R7 ~해요체 통일 (~합니다/~습니다 금지)
 *   R8 금지 문구 (버튼 지시·못 지키는 약속·찍어내기 서론)
 *   R9 숫자는 근거 파일에 있는 것만 (+ draft.calc 에 적은 계산식의 결과)
 *   R10 타이틀 단어는 실제 연관검색어(네이버 자동완성 — _workspace/intent/{슬러그}.json)에 있는 것만
 *   R11 타이틀 틀 찍어내기 금지: 같은 카테고리에 같은 틀(제품명→{X}, 숫자→N)이 있거나, 같은 앞머리를 3편 이상이 쓰면 FAIL
 *
 *  사용:
 *   node scripts/check-article.js {카테고리/슬러그} {draft.json} [--facts 근거파일] [--intent 검색어파일]
 *     근거파일 기본값: source-data/{슬러그}.json (식약처 원문). 없으면 R9 FAIL = 근거 없이 작성 금지.
 *   node scripts/check-article.js --calibrate   # 기준 글 PASS / 레거시 나열형 FAIL 재확인 (public/data 필요)
 *  종료코드: PASS 0 / FAIL 1 / 사용법 오류 2
 */
const fs = require("fs");
const path = require("path");

const SPEC = /(성분|효능|효과|복용법|사용법|용법|용량|부작용|주의사항|보관)/g;
const BANNED = ["아래 버튼에서", "실시간", "핵심부터 말하면", "결론부터 말하면", "정리했어요", "정리했습니다", "솔직히", "—"];
const PARTICLE_ONE = /(이에요|예요|인가요|일까요|할까요|나요|까지|부터|에서|으로|과|와|은|는|이|가|을|를|의|도|로|\?)$/;
// 조사를 하나씩 떼되 두 글자 미만이 되면 멈춘다 ("효과"의 '과'를 조사로 잘라 "효"가 되던 결함 수정)
function stripP(w) { let m; while ((m = w.match(PARTICLE_ONE)) && w.length - m[0].length >= 2) w = w.slice(0, -m[0].length); return w; }
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
  return t.split(/[\s,?·|]+/).map(stripP).filter((w) => (w.length >= 2 || /\d/.test(w)) && !STOP.has(w) && !/[요까]$/.test(w)); // "있나요"·"될까" 같은 질문 어미는 검색 단어가 아님
}

function numbersIn(text) {
  return (String(text).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((x) => String(Number(x.replace(/,/g, "")))); // "07" = "7"
}


// R11: 타이틀 틀 = 첫 어절(제품명)→{X}, 숫자→N.  앞머리 = 첫 쉼표·물음표 앞
// 제품명 = 첫 어절 + 바로 뒤 용량 어절(5%, 200ml, 1mg, 30정 …)
const skeleton = (t) => { const w = String(t || "").split(/\s+/); let i = 1; while (i < w.length && /^[\d.,]+(%|mg|ml|mL|g|정|캡슐)?[,?]?$/.test(w[i])) i++; return ["{X}", ...w.slice(i)].join(" ").replace(/\d[\d,.]*/g, "N"); };
const leadOf = (sk) => sk.split(/[,?|]/)[0].trim();
function liveTitles(cat, slug) {
  const dir = path.join("public", "data", cat);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== slug + ".json")
    .map((f) => { try { return [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).title]; } catch { return null; } }).filter(Boolean);
}

function check(slug, d, factsText, intent) {
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
  if (/온라인/.test(title + body)) fails.push("R6 \"온라인\" 표현 금지 — 일반의약품은 온라인 판매 불가. 가격은 약국 판매가");
  if (/\d[\d,]*\s*원/.test(body) && !(/가격비교/.test(body) && /\d{4}년\s*\d{1,2}월\s*기준/.test(body)))
    fails.push("R6 가격 숫자엔 출처와 시점 필수 — 예: \"약국 가격비교 서비스에서 25,000원으로 확인돼요(2026년 7월 기준)\"");
  const formal = body.match(/[가-힣]*(합니다|습니다|됩니다)(?=[.\s]|$)/g);
  if (formal) fails.push(`R7 ~합니다체 ${formal.slice(0, 3).join(", ")} — ~해요체로 통일`);
  const banned = BANNED.filter((b) => (title + "\n" + body).includes(b));
  if (banned.length) fails.push(`R8 금지 문구: ${banned.join(", ")}`);


  if (intent !== undefined) {
    if (intent === null) fails.push(`R10 실제 연관검색어 파일 없음 (_workspace/intent/${slug.split("/").pop()}.json) — 네이버 자동완성을 먼저 수집 (node scripts/intent-harvest.mjs "{키워드}" --slug ${slug.split("/").pop()})`);
    else {
      const kw = String(intent.keyword || name);
      const allowed = new Set();
      for (const q of intent.userQuestions || []) for (const w of String(q).replace(kw, " ").replace(name, " ").split(/[\s,?·|]+/)) { const t = stripP(w); if (t) allowed.add(t); }
      const off = titleKeywords(title, name).filter((k) => ![...allowed].some((a) => a === k || a.startsWith(k) || k.startsWith(a)));
      if (off.length) fails.push(`R10 타이틀 단어가 실제 연관검색어에 없음: ${off.join(", ")} (연관검색어: ${[...allowed].join(", ") || "없음"})`);
    }
    const live = liveTitles(slug.split("/")[0], slug.split("/").pop());
    if (live) {
      const sk = skeleton(title), lead = leadOf(sk);
      const twin = live.filter(([, t]) => skeleton(t) === sk).map(([k]) => k);
      const sameLead = live.filter(([, t]) => leadOf(skeleton(t)) === lead).map(([k]) => k);
      if (twin.length) fails.push(`R11 타이틀 틀이 같은 글 있음: "${sk}" = ${twin.slice(0, 3).join(", ")}`);
      else if (sameLead.length >= 3) fails.push(`R11 타이틀 앞머리 "${lead}" 를 ${sameLead.length}편이 이미 씀 (${sameLead.slice(0, 3).join(", ")}) — 실제 연관검색어로 다르게`);
    }
  }

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
  const struct = (k, d) => check(k, d, "").filter((f) => !f.startsWith("R9")); // R10·R11은 글마다 검색어·주변 글이 달라 여기선 제외
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
const ii = args.indexOf("--intent");
const intentPath = ii > -1 ? args[ii + 1] : path.join("_workspace", "intent", slug.split("/").pop() + ".json");
const intent = fs.existsSync(intentPath) ? JSON.parse(fs.readFileSync(intentPath, "utf8")) : null;
const d = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const fails = check(slug, d, factsText, intent);
if (fails.length) { console.log(`CHECK FAIL ${slug}\n- ` + fails.join("\n- ")); process.exit(1); }
console.log(`CHECK PASS ${slug} (소제목 ${d.sections.length}개)`);
