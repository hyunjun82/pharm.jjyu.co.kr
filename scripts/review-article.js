#!/usr/bin/env node
/**
 * review-article.js — Layer 3: 의미 검수 게이트 (숫자 게이트가 못 잡는 '해석 오류'를 잡는다)
 *
 * 숫자 일치(verify-facts/B1)와 별개로, 본문 각 주장이 소스의 '뜻'을 충실히 옮겼는지
 * 격리된 reviewer LLM(claude -p)이 소스 브리프와 대조해 검토한다.
 *   - 부작용 %를 엉뚱한 그룹에 붙임 / 적응증 뉘앙스 왜곡 / 소스에 없는 단정 / 인과 과장 등
 *
 * 사용법: node scripts/review-article.js {slug} {draft.json}
 * 종료코드: 0 = REVIEW PASS, 1 = REVIEW FAIL(사유 stdout)
 *
 * 사전조건: PC에 Claude Code CLI 로그인(claude -p 사용). 토큰 절약 위해 작성 통과분에만 실행 권장.
 */
const fs = require("fs");
const { execSync } = require("child_process");

const [slug, draftFile] = process.argv.slice(2);
if (!slug || !draftFile) { console.log("usage: node scripts/review-article.js {slug} {draft.json}"); process.exit(2); }

const briefPath = `_workspace/briefs/${slug}.json`;
if (!fs.existsSync(briefPath)) { console.log(`REVIEW SKIP: 브리프 없음(${briefPath})`); process.exit(0); }
const brief = fs.readFileSync(briefPath, "utf8");
const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
const body = [draft.heroDescription, ...draft.sections.map((s) => `## ${s.title}\n${s.content}`), ...draft.faq.map((f) => `Q:${f.question}\nA:${f.answer}`)].join("\n\n");

const prompt = `당신은 의약품 콘텐츠 팩트체커입니다. 아래 [소스]는 식약처/약학정보원 등에서 수집한 사실이고, [글]은 그 소스로 작성된 글입니다.
[글]의 각 주장이 [소스]의 '의미'를 충실히 옮겼는지 검토하세요. 숫자 일치는 다른 단계에서 검사하므로, 당신은 '해석·맥락 오류'에 집중합니다.

다음을 찾으세요:
- 소스에 근거 없는 단정·효능 과장
- 부작용/임상 수치를 엉뚱한 대상군(투약군↔위약군, 적응증 등)에 잘못 귀속
- 적응증/금기/용법의 뜻을 왜곡하거나 범위를 임의로 넓힘
- 인과관계가 소스에 없는데 단정한 표현
- 소스와 모순되는 서술

각 문제는 한 줄로: [섹션] 문제요약. 문제가 하나도 없으면 정확히 "REVIEW PASS"만, 하나라도 있으면 첫 줄에 "REVIEW FAIL" 후 문제 목록을 출력하세요.

[소스]
${brief}

[글]
${body}`;

let out = "";
try {
  out = execSync(`claude -p --model sonnet --output-format text`, { input: prompt, encoding: "utf8", maxBuffer: 1024 * 1024 * 20, timeout: 300000, windowsHide: true });
} catch (e) {
  console.log("REVIEW ERROR: reviewer 호출 실패 — " + String(e.message).slice(0, 120));
  console.log("(PC에 Claude Code CLI 로그인 필요. 무인배치는 통과 작성분에만 실행)");
  process.exit(2);
}

if (/REVIEW PASS/.test(out) && !/REVIEW FAIL/.test(out)) {
  console.log("REVIEW PASS ✓ (의미 검수 통과 — 소스 해석 충실)");
  process.exit(0);
}
console.log("REVIEW FAIL");
console.log(out.trim().split("\n").slice(0, 15).join("\n"));
process.exit(1);
