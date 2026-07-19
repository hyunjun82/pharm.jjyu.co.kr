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

// ── 푸시 직전 품질 게이트 (부분 배포 시 — 품질 미달이면 배포 중단) ──
const _si = args.indexOf("--slugs");
const _slugArg = _si > -1 && args[_si+1] && !args[_si+1].startsWith("--") ? args[_si+1] : "";
if (_slugArg) {
  console.log("🛡️  푸시 직전 품질 게이트 실행");
  try { execSync(`node scripts/pre-deploy-gate.js "${_slugArg}"`, { cwd: ROOT, stdio: "inherit" }); }
  catch { console.error("\n🚫 품질 미달로 배포 중단. 해당 글 수정 후 다시 푸시하세요."); process.exit(1); }
}

// ── 사이트맵 전체 보정 (부분 빌드가 사이트맵을 필터본으로 덮어쓰는 버그 차단) ──
console.log("🗺️  전체 사이트맵 재생성 → 스냅샷에 강제 반영");
execSync("node scripts/generate-sitemap.js", { cwd: ROOT, stdio: "inherit" });
cpSync(join(ROOT, "public", "sitemap.xml"), join(SNAPSHOT, "sitemap.xml"));

// ── RSS 피드 재생성 (네이버 서치어드바이저 RSS — feed.xml 404 방지, 2026-07-02 추가) ──
console.log("📡 feed.xml 재생성 → 스냅샷에 반영");
execSync("node scripts/generate-feed.js", { cwd: ROOT, stdio: "inherit" });
cpSync(join(ROOT, "public", "feed.xml"), join(SNAPSHOT, "feed.xml"));

// ── IndexNow 키 파일 스냅샷 강제 반영 (2026-07-19 사고 수리) ──
// 실측: clean-out.mjs가 키 .txt까지 삭제해 라이브 404 → 빙·네이버가 IndexNow 통지 전부 무시 상태였음.
// clean-out은 수정했지만, 과거 스냅샷에 이미 빠져있으므로 매 배포마다 여기서 무조건 다시 넣는다.
const INDEXNOW_KEY_FILE = "9c135131626d49088fa4bfff9b5e8672.txt";
cpSync(join(ROOT, "public", INDEXNOW_KEY_FILE), join(SNAPSHOT, INDEXNOW_KEY_FILE));
console.log("🔑 IndexNow 키 파일 스냅샷 반영 완료");

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

// ── IndexNow 통지 (빙+네이버 즉시 수집 요청 — 2026-07-06 추가) ──
if (_slugArg) {
  try { execSync(`node scripts/ping-indexnow.mjs "${_slugArg}"`, { cwd: ROOT, stdio: "inherit" }); }
  catch { console.log("IndexNow 통지 실패 (배포는 정상 — 다음 배포 때 재시도)"); }
}

console.log(`
배포 완료!
   라이브 사이트: https://pharm.jjyu.co.kr/
   배포 상태: https://dash.cloudflare.com/d2e4e8fa6127e6e2ba40e48fe715aeef/pages/view/pharm-jjyu-co-kr
`);
