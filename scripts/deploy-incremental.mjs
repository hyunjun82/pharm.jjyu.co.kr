/**
 * deploy-incremental.mjs — 변경된 spoke만 빌드 + Cloudflare Pages 직접 배포
 *
 * 사용법:
 *   node scripts/deploy-incremental.mjs                          # git diff로 자동 감지
 *   node scripts/deploy-incremental.mjs --category 탈모           # 카테고리 전체 부분 배포
 *   node scripts/deploy-incremental.mjs --slugs 탈모/미녹시딜      # 특정 슬러그만
 *
 * 사전 조건:
 *   1) Cloudflare 대시보드 → Pages → Settings → "Pause builds" (자동 빌드 중지)
 *   2) .env.local에 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID 설정
 *      또는 환경변수로 export
 *
 * 동작:
 *   1) build-new.mjs로 변경된 슬러그만 부분 빌드 → out/{cat}/{slug}/
 *   2) wrangler pages deploy out/ — Cloudflare가 변경 파일만 자동 감지
 *   3) 결과 URL 출력
 *
 * 소요 시간: 약 1~3분 (전체 빌드 11분 → 1/4)
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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
const buildArgs = args.join(" ");

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

console.log("\n☁️  Step 2: Cloudflare Pages 배포 (변경 파일만 자동 감지)");
console.log("─".repeat(50));
try {
  execSync(
    `npx wrangler pages deploy out --project-name=${PROJECT_NAME} --branch=main`,
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
