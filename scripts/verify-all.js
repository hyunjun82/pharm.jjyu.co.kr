/**
 * 4층 검증 통합 실행기
 *
 * 사용법:
 *   node scripts/verify-all.js               전체 4층 검증
 *   node scripts/verify-all.js --slug 마데카솔  특정 slug만 4층 전체
 *   node scripts/verify-all.js --layer 2      특정 레이어만
 *   node scripts/verify-all.js --warn-only    WARN만 표시 (PASS 판정)
 */

const { execSync } = require("child_process");
const path = require("path");

const SCRIPTS = [
  { layer: 1, name: "Source Gate", file: "verify-source.js" },
  { layer: 2, name: "Fact Gate", file: "verify-facts.js" },
  { layer: 3, name: "Style Gate", file: "verify-style.js" },
  { layer: 4, name: "Self-Check Gate", file: "verify-selfcheck.js" },
];

function main() {
  const args = process.argv.slice(2);
  const singleLayer = args.includes("--layer")
    ? parseInt(args[args.indexOf("--layer") + 1])
    : null;
  const warnOnly = args.includes("--warn-only");

  // --slug, --category 등은 하위 스크립트에 그대로 전달
  const passthrough = args
    .filter((a) => a !== "--warn-only" && a !== "--layer" && !args[args.indexOf("--layer") + 1]?.includes(a))
    .join(" ");

  console.log("==================================================");
  console.log("  pharm-jjyu 4층 검증 시스템");
  console.log("==================================================\n");

  const results = [];
  let allPass = true;

  for (const script of SCRIPTS) {
    if (singleLayer && script.layer !== singleLayer) continue;

    console.log(`--- Layer ${script.layer}: ${script.name} ---`);
    const scriptPath = path.join(__dirname, script.file);

    try {
      const output = execSync(`node "${scriptPath}" ${passthrough}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      });
      console.log(output);
      results.push({ ...script, status: "PASS" });
    } catch (e) {
      // exit code 1 = FAIL
      const output = e.stdout || "";
      const stderr = e.stderr || "";
      console.log(output);
      if (stderr && !stderr.includes("ExperimentalWarning")) {
        console.error(stderr);
      }

      if (warnOnly) {
        results.push({ ...script, status: "WARN" });
      } else {
        results.push({ ...script, status: "FAIL" });
        allPass = false;
      }
    }
    console.log("");
  }

  // 최종 결과
  console.log("==================================================");
  console.log("  최종 결과");
  console.log("==================================================\n");

  for (const r of results) {
    const icon = r.status === "PASS" ? "PASS" : r.status === "WARN" ? "WARN" : "FAIL";
    console.log(`  Layer ${r.layer} ${r.name}: ${icon}`);
  }

  console.log("");
  if (allPass) {
    console.log("  4층 검증 전체 PASS");
  } else {
    console.log("  4층 검증 FAIL — 에러 수정 필요");
    process.exit(1);
  }
}

main();
