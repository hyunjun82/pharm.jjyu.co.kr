#!/usr/bin/env node
/**
 * 연속 배치 루프 (2026-07-02) — 카테고리가 끝날 때까지 auto-batch를 자동 반복
 * 사용: node scripts/auto-batch-loop.mjs --category 탈모 [--batch 20] [--rounds 20]
 * 중단 조건: 큐 소진 / 라운드 상한 / 한 라운드 통과 0 & 에스컬 100% (품질 급락 가드)
 */
import { execSync } from "child_process";
import fs from "fs";
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 && args[i+1] ? args[i+1] : d; };
const CAT = opt("--category", null);
const BATCH = +opt("--batch", 20);
const ROUNDS = +opt("--rounds", 30);
const MODEL = opt("--model", "sonnet");
const TRIES = opt("--tries", "3");
if (!CAT) { console.error("--category 필수"); process.exit(1); }
for (let r = 1; r <= ROUNDS; r++) {
  console.log(`\n════════ 라운드 ${r}/${ROUNDS} (${CAT}, ${BATCH}편) ════════`);
  let out = "";
  try { out = execSync(`node scripts/auto-batch.mjs --category ${CAT} --batch ${BATCH} --model ${MODEL} --tries ${TRIES}`, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1024*1024*50 }); }
  catch (e) { out = String(e.stdout || ""); }
  process.stdout.write(out);
  const m = out.match(/배치 결과: 통과 (\d+) \/ 에스컬레이션 (\d+) \/ 차단 (\d+)/);
  if (!m) { console.log("결과 파싱 실패 — 안전 중단"); break; }
  const [_, pass, esc, blocked] = m.map(Number);
  // 통과분 즉시 부분배포 (배포는 스냅샷 병합이라 안전)
  const dep = out.match(/deploy-incremental\.mjs --slugs (\S+)/);
  if (dep) {
    console.log("→ 통과분 자동 배포...");
    try { execSync(`node scripts/deploy-incremental.mjs --slugs ${dep[1]}`, { stdio: "inherit" }); }
    catch { console.log("배포 실패 — 수동 배포 필요: --slugs " + dep[1]); }
  }
  if (pass + esc + blocked === 0) { console.log("큐 소진 — 카테고리 완료 🎉"); break; }
  if (pass === 0 && esc > 0 && TRIES !== "1") { console.log("통과 0 가드 — 루프 중단 (에스컬 큐를 상위 모델로 마감 후 재개)"); break; }
  if (TRIES === "1" && esc > 0) console.log(`초안 공급 모드: 에스컬 ${esc}건 적재 — 다음 라운드 계속`);
  if (pass === 0 && esc === 0 && blocked > 0) console.log("전량 소스차단 라운드 — 다음 라운드 계속 (차단은 자동 스킵됨)");
}
console.log("\n루프 종료. 에스컬레이션 큐: _workspace/escalation-queue.json");
