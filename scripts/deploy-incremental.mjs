/**
 * deploy-incremental.mjs — 변경된 spoke만 빌드 + 전체 스냅샷에 병합 + Cloudflare Pages 배포
 *
 * ⚠️ 2026-06-13 사고 교훈 (절대 되돌리지 말 것):
 *   Cloudflare Pages는 매 배포가 "전체 스냅샷"이다. 업로드한 디렉터리에 있는 파일만
 *   서빙되고 나머지는 전부 404가 된다. ("변경 파일만 자동 감지"는 업로드 중복제거일 뿐,
 *   서빙과 무관.) 부분 빌드한 out/만 배포했다가 사이트 2,700페이지가 11페이지로 교체돼
 *   캐시 만료와 함께 전역 404가 발생했다 → 43158fcd로 롤백해 복구.
 *   → 해결: 부분 빌드 결과를 영구 스냅샷(_full-out/)에 병합한 뒤 _full-out/을 통째로 배포.
 *
 * 사용법:
 *   node scripts/deploy-incremental.mjs --full                   # 풀빌드 → 스냅샷 재생성 → 전체 배포 (최초 1회 필수)
 *   node scripts/deploy-incremental.mjs                          # git diff로 자동 감지 (스냅샷에 병합)
 *   node scripts/deploy-incremental.mjs --category 탈모           # 카테고리 전체 부분 배포
 *   node scripts/deploy-incremental.mjs --slugs 탈모/미녹시딜      # 특정 슬러그만
 *
 * 사전 조건:
 *   1) Cloudflare 대시보드 → Pages → Settings → "Pause builds" (자동 빌드 중지)
 *   2) .env.local에 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID 설정
 *   3) _full-out/ 스냅샷 존재 (--full 1회 실행으로 생성. 없으면 부분배포 차단됨)
 *
 * 소요 시간: 부분배포 약 1~3분 / --full 약 11분
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SNAPSHOT = join(ROOT, "_full-out");

// ── .env.local 로드 (있으면) ─────────────────────────
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error(`
❌ CLOUDFLARE_API_TOKEN이 설정되지 않았어요.

발급 방법:
  1) https://dash.cloudflare.com/profile/api-tokens 접속
  2) "Create Token" → Custom Token
  3) Permissions: Account → Cloudflare Pages → Edit
  4) Account Resources: pharm-jjyu-co-kr 선택
  5) 발급된 토큰을 .env.local에 저장:
     CLOUDFLARE_API_TOKEN=발급받은_토큰
     CLOUDFLARE_ACCOUNT_ID=d2e4e8fa6127e6e2ba40e48fe715aeef
`);
  process.exit(1);
}

const PROJECT_NAME = "pharm-jjyu-co-kr";
const args = process.argv.slice(2);
const isFull = args.includes("--full");
const isDeployOnly = args.includes("--deploy-only");
const buildArgs = args.filter((a) => a !== "--full" && a !== "--deploy-only").join(" ");

if (isDeployOnly) {
  // 빌드 생략 — 기존 _full-out/ 스냅샷을 그대로 업로드 (.env.local 토큰 자동 로드)
  if (!existsSync(join(SNAPSHOT, "index.html"))) {
    console.error("❌ _full-out/ 스냅샷이 없어요. --full을 먼저 실행하세요.");
    process.exit(1);
  }
  console.log("⏭️  빌드 생략 — 기존 _full-out/ 스냅샷 업로드만 진행");
} else if (isFull) {
  console.log("🔨 Step 1: 풀빌드 → _full-out/ 스냅샷 재생성");
  console.log("─".repeat(50));
  try {
    // ⚠️ 반드시 npm run build (generate-article-json → next build → clean-out 순서).
    // next build만 돌리면 public/data JSON이 갱신되지 않아 구버전 글이 배포됨 (2026-06-13 확인).
    execSync("npm run build", { cwd: ROOT, stdio: "inherit", env: { ...process.env } });
  } catch {
    console.error("\n❌ 풀빌드 실패");
    process.exit(1);
  }
  rmSync(SNAPSHOT, { recursive: true, force: true });
  cpSync(join(ROOT, "out"), SNAPSHOT, { recursive: true });
  execSync("node scripts/clean-out.mjs _full-out", { cwd: ROOT, stdio: "inherit" }); // npm run build의 clean-out은 out/만 청소
  console.log("📸 _full-out/ 스냅샷 재생성 완료 (전체 사이트)");
} else {
  if (!existsSync(join(SNAPSHOT, "index.html"))) {
    console.error(`
❌ _full-out/ 전체 스냅샷이 없어요. 부분배포는 스냅샷 위에 병합해야 안전해요.
   (부분 빌드 out/만 배포하면 사이트의 나머지 페이지가 전부 404가 됩니다 — 2026-06-13 사고)

   먼저 1회 실행: node scripts/deploy-incremental.mjs --full
`);
    process.exit(1);
  }
  console.log("🔨 Step 1: 변경된 spoke만 부분 빌드");
  console.log("─".repeat(50));
  try {
    execSync(`node scripts/build-new.mjs ${buildArgs}`, {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    console.error("\n❌ 부분 빌드 실패");
    process.exit(1);
  }
  cpSync(join(ROOT, "out"), SNAPSHOT, { recursive: true, force: true });
  execSync("node scripts/clean-out.mjs _full-out", { cwd: ROOT, stdio: "inherit" }); // 20,000 파일 제한 대응
  console.log("📸 부분 빌드 결과를 _full-out/ 스냅샷에 병합 완료");
}

console.log("\n☁️  Step 2: Cloudflare Pages 배포 (_full-out/ 전체 스냅샷 — 변경 파일만 실제 전송)");
console.log("─".repeat(50));
try {
  execSync(
    `npx wrangler pages deploy _full-out --project-name=${PROJECT_NAME} --branch=main --commit-message="${isFull ? "Full snapshot deploy" : "Partial deploy (merged into snapshot)"}" --commit-dirty=true`,
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env },
    }
  );
} catch {
  console.error("\n❌ Cloudflare 배포 실패");
  console.error("자동 빌드 모드가 켜져있을 수 있어요. 대시보드 확인:");
  console.error("https://dash.cloudflare.com/d2e4e8fa6127e6e2ba40e48fe715aeef/pages/view/pharm-jjyu-co-kr/settings/builds-deployments");
  process.exit(1);
}

console.log(`
✅ 배포 완료!
   라이브 사이트: https://pharm.jjyu.co.kr/
   배포 상태: https://dash.cloudflare.com/d2e4e8fa6127e6e2ba40e48fe715aeef/pages/view/pharm-jjyu-co-kr
`);
