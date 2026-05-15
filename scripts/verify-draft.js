/**
 * verify-draft.js
 *
 * writer가 작성한 draft를 brief.json과 대조해 8항목 자동 검증.
 *
 * 사용법:
 *   node scripts/verify-draft.js {slug}                 # 8항목 전부
 *   node scripts/verify-draft.js {slug} --rule=fact     # 개별 항목
 *
 * 출력:
 *   _workspace/{slug}-verify.json
 *
 * 8항목:
 *   R1-fact         본문 정량 데이터 ⊆ brief.facts.numericValues
 *   R2-doorway      5-gram overlap < 30% (verify-doorway.js 호출)
 *   R3-intent       sections.title 순서가 intent template과 일치
 *   R4-price        verify-price.js 호출
 *   R5-density      100자당 숫자 ≥ 2.0
 *   R6-citation     1,000자당 식약처/품목번호/허가사항/임상 ≥ 1
 *   R7-style        받침조사 + forbiddenWords + ~합니다 부재 (verify-style.js 호출)
 *   R8-fakeEmpathy  가짜 공감 후킹 6개 부재
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const WORKSPACE_DIR = path.resolve(__dirname, "..", "_workspace");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "quality-config.json"), "utf8"));
const GLOBAL = CONFIG.globalRules || {};
const INTENTS = CONFIG.intents || {};
const FAKE_EMPATHY = CONFIG.style?.fakeEmpathyHooks || [];
const CITATION_KEYWORDS = GLOBAL.sourceCitationKeywords || ["식약처", "품목번호", "허가사항", "임상시험", "허가코드"];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function extractAllContent(draftText) {
  return (draftText.match(/content:\s*"((?:[^"\\]|\\.)*)"/g) || []).map((m) => m.replace(/^content:\s*"|"$/g, ""));
}

function ruleFact(draftText, brief) {
  const violations = [];
  const allowed = new Set(brief.facts.numericValues || []);
  const contents = extractAllContent(draftText).join("\n");
  // 본문 숫자 추출
  const numbers = contents.match(/\b\d+(?:\.\d+)?\s*(?:mg|%|mL|ml|일|회|개월|년|세|정|캡슐|포|배)?\b/g) || [];
  const unique = [...new Set(numbers.map((n) => n.trim()))];
  const unlisted = unique.filter((n) => {
    // facts.numericValues에 부분 매칭이라도 있으면 통과
    for (const a of allowed) if (a.includes(n) || n.includes(a)) return false;
    return true;
  });
  if (unlisted.length > 0) {
    violations.push({
      rule: "R1-fact",
      msg: `brief.facts.numericValues에 없는 숫자 ${unlisted.length}개`,
      sample: unlisted.slice(0, 5).join(", "),
    });
  }
  return violations;
}

function ruleIntent(draftText, brief) {
  const violations = [];
  const intent = INTENTS[brief.searchIntent];
  if (!intent) return [{ rule: "R3-intent", msg: `searchIntent ${brief.searchIntent} 미정의` }];

  const expected = intent.sectionTitles || [];
  const titleMatches = [...draftText.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
  const actual = titleMatches.slice(1); // 첫 title은 article.title일 가능성

  if (actual.length < expected.length) {
    violations.push({ rule: "R3-intent", msg: `H2 개수 ${actual.length} < expected ${expected.length}` });
  }

  // 순서 검사: expected[i] 패턴이 actual[i]에 포함되는지
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    const tmpl = expected[i].replace("{slug}", brief.slug).replace("{usage}", "복용법");
    const tmplKeywords = tmpl.split(/[\s가나요]/).filter((k) => k.length > 2);
    const ok = tmplKeywords.every((k) => actual[i].includes(k.slice(0, 3)));
    if (!ok) {
      violations.push({
        rule: "R3-intent",
        msg: `H2[${i}] 순서 불일치`,
        expected: tmpl,
        actual: actual[i],
      });
    }
  }
  return violations;
}

function ruleDensity(draftText) {
  const contents = extractAllContent(draftText).join(" ");
  const charCount = contents.length;
  const numCount = (contents.match(/\d/g) || []).length;
  const density = charCount > 0 ? (numCount / charCount) * 100 : 0;
  const target = GLOBAL.minNumberDensity || 2.0;
  if (density < target) {
    return [{ rule: "R5-density", msg: `숫자 밀도 ${density.toFixed(2)} < ${target} (100자당)` }];
  }
  return [];
}

function ruleCitation(draftText) {
  const contents = extractAllContent(draftText).join(" ");
  const charCount = contents.length;
  let cites = 0;
  for (const kw of CITATION_KEYWORDS) {
    cites += (contents.match(new RegExp(kw, "g")) || []).length;
  }
  const expected = Math.max(1, Math.floor(charCount / 1000));
  if (cites < expected) {
    return [{ rule: "R6-citation", msg: `출처 인용 ${cites}회 < 기대 ${expected}회 (1,000자당 1회)` }];
  }
  return [];
}

function ruleFakeEmpathy(draftText) {
  const violations = [];
  const contents = extractAllContent(draftText).join(" ");
  for (const hook of FAKE_EMPATHY) {
    if (contents.includes(hook)) {
      violations.push({ rule: "R8-fakeEmpathy", msg: `가짜 공감 후킹 발견: "${hook}"` });
    }
  }
  return violations;
}

function runSubScript(scriptName, slug) {
  try {
    execSync(`node "${path.join(__dirname, scriptName)}" ${slug}`, { stdio: "pipe" });
    return { pass: true, violations: [] };
  } catch (e) {
    const out = e.stdout?.toString() || e.message;
    return { pass: false, violations: [{ rule: scriptName, msg: out.split("\n").slice(-5).join(" | ") }] };
  }
}

function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const ruleFilter = args.find((a) => a.startsWith("--rule="))?.replace("--rule=", "");

  if (!slug) {
    console.error("Usage: verify-draft.js {slug} [--rule=fact|intent|density|citation|empathy]");
    process.exit(1);
  }

  if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  const briefFile = path.join(WORKSPACE_DIR, `${slug}-brief.json`);
  const draftFile = path.join(WORKSPACE_DIR, `${slug}-draft.ts`);

  if (!fs.existsSync(briefFile)) {
    console.error(`ABORT: ${briefFile} 없음`);
    process.exit(1);
  }
  if (!fs.existsSync(draftFile)) {
    console.error(`ABORT: ${draftFile} 없음`);
    process.exit(1);
  }

  const brief = readJson(briefFile);
  const draftText = fs.readFileSync(draftFile, "utf8");
  const violations = [];
  const passDetails = {};

  const wantRule = (r) => !ruleFilter || ruleFilter === r;

  if (wantRule("fact")) {
    const v = ruleFact(draftText, brief);
    passDetails["R1-fact"] = v.length === 0 ? "pass" : "fail";
    violations.push(...v);
  }
  if (wantRule("doorway")) {
    const r = runSubScript("verify-doorway.js", slug);
    passDetails["R2-doorway"] = r.pass ? "pass" : "fail";
    violations.push(...r.violations);
  }
  if (wantRule("intent")) {
    const v = ruleIntent(draftText, brief);
    passDetails["R3-intent"] = v.length === 0 ? "pass" : "fail";
    violations.push(...v);
  }
  if (wantRule("price")) {
    const r = runSubScript("verify-price.js", slug);
    passDetails["R4-price"] = r.pass ? "pass" : "fail";
    violations.push(...r.violations);
  }
  if (wantRule("density")) {
    const v = ruleDensity(draftText);
    passDetails["R5-density"] = v.length === 0 ? "pass" : "fail";
    violations.push(...v);
  }
  if (wantRule("citation")) {
    const v = ruleCitation(draftText);
    passDetails["R6-citation"] = v.length === 0 ? "pass" : "fail";
    violations.push(...v);
  }
  // R7-style은 기존 verify-style.js 활용 (별도 통합 미구현)
  if (wantRule("empathy")) {
    const v = ruleFakeEmpathy(draftText);
    passDetails["R8-fakeEmpathy"] = v.length === 0 ? "pass" : "fail";
    violations.push(...v);
  }

  const pass = violations.length === 0;
  const result = { slug, pass, violations, passDetails, generatedAt: new Date().toISOString() };

  const outFile = path.join(WORKSPACE_DIR, `${slug}-verify.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");

  console.log(`\n=== verify-draft: ${slug} ===`);
  Object.entries(passDetails).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\n  결과: ${pass ? "✅ PASS" : `❌ FAIL (위반 ${violations.length}건)`}`);
  if (!pass) {
    violations.slice(0, 10).forEach((v) => console.log(`    - ${v.rule}: ${v.msg || JSON.stringify(v).slice(0, 200)}`));
  }

  if (!pass) process.exit(2);
}

main();
