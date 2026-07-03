// 한도 에러로 초안 없이 에스컬된 항목을 재시도 대상으로 복귀 (2026-07-03)
// 사용: node scripts/requeue-no-draft.js   (배치 재시작 전에 1회)
const fs = require("fs");
const EQ = "_workspace/escalation-queue.json";
let eq = [];
try { eq = JSON.parse(fs.readFileSync(EQ, "utf8")); } catch { console.log("큐 파싱 실패 — 건너뜀"); process.exit(0); }
const keep = [], retry = [];
for (const x of eq) {
  const p = `_workspace/batch-logs/draft-${x.slug}.json`;
  if (fs.existsSync(p) && fs.statSync(p).size > 800) keep.push(x);
  else retry.push(x.slug);
}
fs.writeFileSync(EQ, JSON.stringify(keep, null, 1));
fs.writeFileSync("_workspace/retry-after-reset.json", JSON.stringify(retry));
console.log(`초안 있음(마감 대기 유지): ${keep.length} / 재시도 복귀: ${retry.length}`);
console.log("이제 auto-batch-loop을 다시 실행하면 복귀분부터 다시 집습니다.");
