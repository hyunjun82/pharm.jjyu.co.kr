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

// 2026-08-01 전면 교체. 구버전은 `title: "..."`(따옴표 없는 키)만 잡는 정규식 뭉치였다.
//   실측 결함 — objio.js로 갈아끼운 글은 키가 JSON 따옴표꼴(`"title": "..."`)이라
//   재작성 10편 + 기준본까지 11편 전부 "추출 실패"가 났다. 글 문제가 아니라 파서 문제였다.
//   (다행히 실패=차단으로 동작해 미달 글이 새지는 않았다.)
//   이제 엔트리 경계만 문자열로 잡고 값은 JS 리터럴 그대로 평가한다 — 표기법에 안 흔들린다.
function extract(tsSrc, slug) {
  // 엔트리 시작점: "키 줄 바로 다음 줄이 slug 필드"라는 불변식. 따옴표·들여쓰기 혼재를 모두 받는다.
  const RE = /^([ \t]+)("?[^\s:"]+"?): \{\n[ \t]+"?slug"?: "([^"]+)",$/gm;
  let start = -1, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(tsSrc))) { if (m[3] === slug) { start = m.index; break; } }
  if (start < 0) return null;
  let p = tsSrc.indexOf("{", start), depth = 0, end = -1;
  for (; p < tsSrc.length; p++) {
    const c = tsSrc[p];
    if (c === '"') { p++; while (p < tsSrc.length && tsSrc[p] !== '"') { if (tsSrc[p] === "\\") p++; p++; } continue; }
    if (c === "`") { p++; while (p < tsSrc.length && tsSrc[p] !== "`") { if (tsSrc[p] === "\\") p++; p++; } continue; }
    if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = p + 1; break; } }
  }
  if (end < 0) return null;
  let obj;
  try { obj = new Function("return (" + tsSrc.slice(tsSrc.indexOf("{", start), end) + ")")(); }
  catch (e) { console.log(`   추출 오류(${slug}): ${e.message}`); return null; }
  if (!obj || !obj.title || !Array.isArray(obj.sections) || !obj.sections.length) return null;
  obj.faq = obj.faq || [];
  return obj;
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
  // validate-article은 "제품 1개짜리 스포크 글" 규칙이다(B6 글자수 상한, B1 제품 numericWhitelist,
  // T8 H2 제품명 4개 이상). 성분 허브글은 그 대상이 아니다 — 적용하면 구조적으로 영구 차단된다.
  // 2026-08-01: 허브 판정을 '브리프 파일 유무' 추정에서 명시 목록으로 바꿨다.
  //   실측 근거 — 6/19에 만든 낡은 미녹시딜 브리프가 남아 있어 기준본에 스포크 규칙이 적용됐고
  //   B6(5271>4200)·B1·T8로 FAIL이 났다. 글 문제가 아니라 규칙 대상 오판이었다.
  //   허브글도 score·human-feel·crosssim·B20·judge는 그대로 통과해야 한다.
  let HUBS = [];
  try { HUBS = JSON.parse(fs.readFileSync("_workspace/hub-articles.json", "utf8")).hubs || []; } catch {}
  if (HUBS.includes(slug)) {
    console.log(`   ${it}: 성분 허브글(_workspace/hub-articles.json 등재) — 제품 스포크 규칙 validate 스킵. 나머지 게이트는 그대로 적용`);
  } else if (fs.existsSync(`_workspace/briefs/${slug}.json`)) {
    run("validate", `node scripts/validate-article.js "${slug}" "${tmp}"`);
  } else {
    console.log(`   ⚠️  ${it}: 브리프 없음 — validate 스킵. 허브글이면 _workspace/hub-articles.json에 등재하고, 아니면 브리프부터 만드세요.`);
  }
  run("human-feel", `node scripts/human-feel.js "${slug}" "${tmp}"`);
  // 2026-08-12: score를 차단에서 "기록"으로 되돌린다. CLAUDE.md v4.0 §5 원문 —
  //   "섹션 글자수, 어미 다양성, 문장 길이 변동계수, 숫자 밀도, 출처 인용 밀도, 서론 길이, FAQ 수,
  //    judge 총점 … 이 항목들로 발행을 막지 않는다."  score가 재는 게 정확히 그 목록이다.
  // 실측 근거(원칙 0-4): 기준본 탈모/미녹시딜이 자기 score 기준에 미달한다 —
  //   최소 섹션 깊이 187자 < 기준 295자. 기준본이 못 넘는 하한은 유효한 차단선이 아니다.
  //   차단은 1차 기준본 대조(13개 수치)+validate+human-feel+crosssim+B20이 담당한다.
  try { execSync(`node scripts/score-article.js "${slug}" "${tmp}"`, { stdio: "pipe" }); }
  catch { console.log(`   ${it}: ⚠️ score 표준 미달 — 차단하지 않고 개선 큐에 기록 (CLAUDE.md §5)`); }
  // crosssim: 인덱스 없으면 스크립트가 skip(0) 처리
  run("crosssim", `node scripts/verify-crosssim.js "${slug}" "${tmp}"`);
  // B20 인라인
  const b20 = b20TitleIntroMatch(draft);
  if (b20.length) { reasons.push("B20"); console.log(`   ${it}: ${b20.join(" / ")}`); }
  // judge: CLI 없으면 exit 2 → 경고 스킵 (사람이 대신 검토해야 함)
  // 2026-07-19 신설 — judge PASS 캐시: 같은 내용(해시 동일)이 이미 통과했으면 재채점 생략.
  //   실측 근거: 비모보정30정이 동일 내용으로 82점 PASS → 1시간 뒤 재채점에서 79점 FAIL (LLM 채점 요동).
  //   경계선 글이 배포마다 복불복 차단되는 결함 + 통과분 재채점은 토큰 낭비. 내용이 바뀌면 해시가 달라져 자동 재채점.
  // 2026-07-20 신설 — 선행 게이트(validate/human-feel/score/crosssim/B20) 실패 시 judge 호출 자체를 생략.
  //   실측 근거: 기존 코드는 validate가 이미 FAIL이어도 judge(최대 3회 LLM 호출)를 무조건 실행 —
  //   오늘 세션에서 켁시부프로펜정 등 재작성-재배포 반복마다 이미 떨어질 게 확실한 초안까지 judge가
  //   3번씩 채점해 토큰을 태움. 이미 reasons가 있으면(= 이 글은 어차피 배포 차단) judge는 불필요.
  if (reasons.length) {
    console.log(`   ${it}: 선행 게이트 실패(${reasons.join(",")}) — judge 채점 생략(토큰 절약)`);
  } else {
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
      // 2026-08-12: judge를 차단에서 "기록"으로 되돌린다. CLAUDE.md v4.0 §5 원문 —
      //   "judge 총점 … 이 항목들로 발행을 막지 않는다. judge는 차단이 아니라 개선 지시서로 쓴다."
      //   코드가 규정을 어기고 judge<80을 차단으로 쓰고 있었다.
      // 실측 근거(원칙 0-4 "게이트는 자기 표준을 통과시켜야 유효"):
      //   ① 기준본 탈모/미녹시딜이 자기 게이트의 judge에서 FAIL. 기준본이 자기 기준을 못 넘는다.
      //   ② 동일 글 재채점 편차 실측: 로게인 74→60→67→84, 동성미녹시딜3 81→68→74→78→통과.
      //      같은 내용에 10~24점이 움직여 통과 여부가 운에 좌우된다.
      //   차단은 1차 기준본 대조(13개 수치)+validate+score+human-feel+crosssim+B20이 담당한다.
      catch (e) {
        if (e.status === 1) {
          let sc = "";
          try { sc = " (" + JSON.parse(fs.readFileSync(`_workspace/judge/${slug}.json`, "utf8")).total + "점)"; } catch {}
          console.log(`   ${it}: ⚠️ judge 80점 미만${sc} — 차단하지 않고 개선 큐에 기록 (CLAUDE.md §5)`);
        } else judgeSkipped++;
      }
    }
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
