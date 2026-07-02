#!/usr/bin/env node
/**
 * auto-batch.mjs — 무인 배치 오케스트레이터 (Claude Code 헤드리스 기반)
 *
 * 사용:
 *   node scripts/auto-batch.mjs --category 탈모 --batch 10            # 실전 (claude CLI 필요)
 *   node scripts/auto-batch.mjs --repair --batch 10                   # repair-list 수리 모드
 *   node scripts/auto-batch.mjs --category 탈모 --batch 10 --dry      # 모의 테스트 (CLI 없이 루프 검증)
 *
 * 파이프라인(글당): 브리프 게이트 → claude -p 작성(Sonnet) → validate(23규칙)+score
 *   → FAIL시 반려사유 포함 재작성(최대 3회) → 3회 실패시 에스컬레이션 큐 → PASS만 반영(+허브+TS검사)
 * 안전장치: 카테고리 첫 배치는 5편에서 멈추고 운영자 승인 요구(CLAUDE.md 파일럿 규칙)
 * 산출물: _workspace/batch-logs/{ts}.json 보고서 + 통과 슬러그 부분배포 명령 출력
 */
import { execSync } from "child_process";
import fs from "fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? (args[i+1] && !args[i+1].startsWith("--") ? args[i+1] : true) : d; };
const CATEGORY = opt("--category", null);
const BATCH = +opt("--batch", 10);
const DRY = !!opt("--dry", false);
const REPAIR = !!opt("--repair", false);
const DEPLOY = !!opt("--deploy", false);
const MODEL = opt("--model", "sonnet");
const MAX_RETRY = 3;
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const log = { started: ts, mode: REPAIR ? "repair" : "rewrite", category: CATEGORY, dry: DRY, items: [] };

// ── 큐 로드
let queue = [];
const SLUGS = opt("--slugs", null);
if (SLUGS) queue = String(SLUGS).split(",");
else
if (!SLUGS && REPAIR) {
  queue = JSON.parse(fs.readFileSync("_workspace/repair-list.json", "utf8")).map((x) => x.slug);
} else if (!SLUGS) {
  const q = JSON.parse(fs.readFileSync("_workspace/rewrite-queue.json", "utf8"));
  const imap = JSON.parse(fs.readFileSync("_workspace/integrity-map.json", "utf8"));
  const done = new Set(fs.existsSync("_workspace/batch-done.json") ? JSON.parse(fs.readFileSync("_workspace/batch-done.json", "utf8")) : []);
  queue = q.filter((x) => (!CATEGORY || x.cat === CATEGORY))
    .filter((x) => { const m = imap.find((y) => y.slug === x.slug); return m && m.status === "VERIFIED"; })
    .filter((x) => !done.has(x.slug)).map((x) => x.slug);
}
// 파일럿 규칙: done 기록이 없으면(=이 카테고리 첫 배치) 5편 제한
const doneFile = "_workspace/batch-done.json";
const doneList = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, "utf8")) : [];
const isPilot = !REPAIR && !SLUGS && !DRY && doneList.length === 0;
const N = Math.min(BATCH, isPilot ? 5 : BATCH, queue.length);
if (!DRY && !fs.existsSync("_workspace/gram-index.json")) {
  console.log("gram-index 없음 → 전체 빌드(도어웨이 검사 준비)...");
  try { execSync("node scripts/verify-crosssim.js --build", { stdio: "pipe" }); } catch {}
}
console.log(`배치 시작: ${N}편 (${REPAIR ? "수리" : CATEGORY || "전체"}) ${isPilot ? "[파일럿 모드 — 5편 후 승인 필요]" : ""} ${DRY ? "[모의]" : ""}`);

// ── writer 호출
function writeDraft(slug, briefPath, violations, attempt) {
  // 2026-07-02: 벤치마크 템플릿(검증기 회피 수칙 §9 포함)을 실제로 프롬프트에 인라인
  //   — 기존엔 경로만 언급되고 내용이 안 들어가 B16/T2/T8 3연속 반려의 원인이었음
  const benchPath = ".claude/templates/benchmark-master.template.md";
  const bench = fs.existsSync(benchPath) ? "\n\n[벤치마크 마스터 템플릿 — 반드시 준수]\n" + fs.readFileSync(benchPath, "utf8") : "";
  const prompt = fs.readFileSync("prompts/writer-spoke.md", "utf8")
    + bench
    + fs.readFileSync(briefPath, "utf8")
    + (violations ? `\n\n[직전 반려 사유 — 반드시 해결]\n${violations}` : "");
  if (DRY) { // 모의: fixtures에서 공급 (1차는 의도적 불량, 2차는 통과본)
    const fix = `_workspace/fixtures/${slug}.attempt${Math.min(attempt,2)}.json`;
    if (!fs.existsSync(fix)) throw new Error("fixture 없음: " + fix);
    return fs.readFileSync(fix, "utf8");
  }
  // --bare 금지: 인증을 ANTHROPIC_API_KEY로만 받아 OAuth 로그인 PC에서 "Not logged in" 즉사
  // ★ ETIMEDOUT 근본원인(2026-06-20 규명): stdin/@file/cmd.exe 문제가 아니라 "확장사고(thinking) 무한루프"였다.
  //   복잡한 writer 작업 → 빈 thinking_delta만 무한 생성 → 답(JSON) 못 내고 타임아웃. 단순 프롬프트는 사고 안 해 즉답.
  //   해결: MAX_THINKING_TOKENS=0 으로 확장사고 비활성 → 70초 내 정상 작성. 프롬프트는 검증된 stdin(input:) 방식으로 공급.
  // 사고 0=덜렁대서 규칙위반 다발(통과 0%). 8000=통과 품질(섹션길이·숫자출처 충족) 검증됨. 상한이라 무한루프 없음. 편당 길어지므로 timeout 상향.
  // 2026-07-02: CLI 간헐 행 대응 — 10분 타임아웃 + ETIMEDOUT 시 사고예산 절반으로 1회 즉시 재시도
  for (const budget of ["8000", "4000"]) {
    try {
      return execSync(`claude -p --model ${MODEL} --output-format text`, {
        encoding: "utf8", input: prompt, maxBuffer: 1024 * 1024 * 20, timeout: 600000, windowsHide: true,
        env: { ...process.env, MAX_THINKING_TOKENS: budget },
      });
    } catch (e) {
      if (String(e.code) === "ETIMEDOUT" && budget === "8000") { console.log(`   (행 감지 → 사고예산 4000으로 재시도: ${slug})`); continue; }
      throw e;
    }
  }
}
function extractJson(out) {
  const a = out.indexOf("{"); const b = out.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("JSON 없음");
  return JSON.parse(out.slice(a, b + 1));
}
function gate(slug, draftPath) {
  const r = { pass: false, violations: "" };
  try { execSync(`node scripts/validate-article.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
  catch (e) { r.violations += (e.stdout || "") ; return r; }
  try { execSync(`node scripts/score-article.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
  catch (e) { r.violations += (e.stdout || ""); return r; }
  // Layer 2.5: human-feel — AI 찍어내기/규정문서 단조/출처부재/복제양산 차단 (하드 FAIL이면 반려)
  try { execSync(`node scripts/human-feel.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
  catch (e) { r.violations += (e.stdout || ""); return r; }
  // Layer 2.6: satisfaction-judge — 토스급 사용자만족 상한선(검색자 질문 커버리지+경쟁사 초월). claude CLI 없으면(exit2) 스킵.
  if (!DRY) {
    try { execSync(`node scripts/satisfaction-judge.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
    catch (e) { if (e.status === 1) { r.violations += (e.stdout || ""); return r; } else { console.log(`   (만족심판 스킵 — judge 불가: ${slug})`); } }
  }
  // Layer 4: 글로벌 교차 유사도(도어웨이). gram-index 없으면 skip(0), 중복위험(1)이면 반려.
  if (!DRY) {
    try { execSync(`node scripts/verify-crosssim.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
    catch (e) { if (e.status === 1) { r.violations += (e.stdout || ""); return r; } }
  }
  // Layer 3: 의미 검수 (해석 오류 — claude -p). CLI 없으면(exit 2) 건너뜀, 의미오류(exit 1)면 반려.
  if (!DRY) {
    try { execSync(`node scripts/review-article.js "${slug}" "${draftPath}"`, { encoding: "utf8", stdio: "pipe" }); }
    catch (e) {
      if (e.status === 1) { r.violations += (e.stdout || ""); return r; }
      else { console.log(`   (의미검수 건너뜀 — reviewer 불가: ${slug})`); }
    }
  }
  r.pass = true; return r;
}

const passed = [], escalated = [], blocked = [];
for (const slug of queue.slice(0, N)) {
  const item = { slug, attempts: 0, result: "" };
  try {
    // 1) 브리프 게이트
    try { execSync(`node scripts/build-write-brief.js "${slug}"`, { stdio: "pipe" }); }
    catch (e) { item.result = "BLOCKED(소스)"; blocked.push(slug); log.items.push(item); console.log(`⛔ ${slug} 소스 차단`); continue; }
    // 2) 작성→관문 루프
    let violations = null, ok = false;
    for (let att = 1; att <= MAX_RETRY; att++) {
      item.attempts = att;
      const raw = writeDraft(slug, `_workspace/briefs/${slug}.json`, violations, att);
      const draft = extractJson(raw);
      const dp = `_workspace/batch-logs/draft-${slug}.json`;
      fs.writeFileSync(dp, JSON.stringify(draft));
      const g = gate(slug, dp);
      if (g.pass) {
        if (!DRY) {
          execSync(`node scripts/apply-article.js "${slug}" "${dp}"`, { stdio: "pipe" });
          try { execSync(`node scripts/verify-crosssim.js --add "${slug}" "${dp}"`, { stdio: "pipe" }); } catch {}
        }
        else console.log("   (dry: apply skip, no real data change)");
        ok = true; break;
      }
      violations = g.violations.split("\n").slice(0, 12).join("\n");
      console.log(`↻ ${slug} ${att}차 반려: ${violations.split("\n")[1] || ""}`);
    }
    if (ok) { item.result = "PASS"; passed.push(slug); console.log(`✅ ${slug} (${item.attempts}차 통과)`); }
    else { item.result = "ESCALATE"; escalated.push(slug); console.log(`🔺 ${slug} 3회 실패 — 에스컬레이션`); }
  } catch (e) { item.result = "ERROR: " + String(e.message).slice(0, 80); escalated.push(slug); console.log(`❌ ${slug} ${item.result}`); }
  log.items.push(item);
}
// ── 기록·보고
if (!DRY) fs.writeFileSync(doneFile, JSON.stringify([...doneList, ...passed]));
fs.writeFileSync(`_workspace/batch-logs/${ts}.json`, JSON.stringify(log, null, 1));
console.log(`\n══ 배치 결과: 통과 ${passed.length} / 에스컬레이션 ${escalated.length} / 차단 ${blocked.length}`);
if (escalated.length) {
  console.log("에스컬레이션(상위 모델/사람 검토 필요):", escalated.join(", "));
  const EQ = "_workspace/escalation-queue.json";
  const eq = fs.existsSync(EQ) ? JSON.parse(fs.readFileSync(EQ, "utf8")) : [];
  for (const sl of escalated) if (!eq.find((x) => x.slug === sl)) eq.push({ slug: sl, at: ts, category: CATEGORY });
  fs.writeFileSync(EQ, JSON.stringify(eq, null, 1));
  console.log(`→ _workspace/escalation-queue.json 적재 (${eq.length}건 대기) — Cowork에서 "에스컬 마감해줘"로 처리`);
}
if (passed.length) {
  const slugsArg = passed.map((s) => { const m = JSON.parse(fs.readFileSync("_workspace/integrity-map.json", "utf8")).find((y) => y.slug === s); return `${m ? m.cat : CATEGORY}/${s}`; }).join(",");
  console.log(`\n부분배포 명령:\n  node scripts/deploy-incremental.mjs --slugs ${slugsArg}`);
}
if (DEPLOY && !DRY && passed.length) {
  const slugsArg = passed.map((s) => { const m = JSON.parse(fs.readFileSync("_workspace/integrity-map.json", "utf8")).find((y) => y.slug === s); return `${m ? m.cat : CATEGORY}/${s}`; }).join(",");
  console.log(`\n자동 배포 시작(${passed.length}편)...`);
  try { execSync(`node scripts/deploy-incremental.mjs --slugs ${slugsArg}`, { stdio: "inherit" }); console.log("✅ 배포 완료"); }
  catch (e) { console.log("❌ 배포 실패 — 수동 배포 필요: node scripts/deploy-incremental.mjs --slugs " + slugsArg); }
}
if (isPilot && !DRY) console.log("\n⚠️ 파일럿 모드였습니다. 라이브 검수 후 승인되면 다시 실행하세요 (이후 배치 제한 해제).");
