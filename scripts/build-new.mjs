/**
 * build-new.mjs — 변경된 spoke만 부분 빌드
 *
 * 사용법:
 *   node scripts/build-new.mjs                        # git diff로 변경 파일 자동 감지
 *   node scripts/build-new.mjs --category 유산균       # 해당 카테고리 전체
 *   node scripts/build-new.mjs --slugs 유산균/락토핏50대,유산균/일양유산균
 *
 * 동작:
 *   1) 변경된 slug 목록 결정
 *   2) generate-article-json.mjs 실행 (전체 JSON 갱신)
 *   3) spoke-index.json을 새 slug만 포함한 필터 버전으로 교체
 *   4) next build → 해당 페이지만 생성 (카테고리 인덱스 포함)
 *   5) spoke-index.json 복원
 *
 * 결과:
 *   out/ 에 새 페이지 HTML만 생성됨
 *   → git push로 Cloudflare에 전체 배포는 별도 (npm run build)
 *   → 빠른 로컬 검증 & 확인용으로 사용
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPOKE_INDEX = join(ROOT, "public", "data", "spoke-index.json");
const SPOKE_INDEX_BAK = join(ROOT, "public", "data", "spoke-index.bak.json");

// ── 인수 파싱 ──────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

let targetPairs = []; // [{ category, slug }]

const categoryArg = getArg("--category");
const slugsArg = getArg("--slugs");

if (slugsArg) {
  // --slugs 유산균/락토핏50대,유산균/일양유산균
  for (const pair of slugsArg.split(",")) {
    const [category, slug] = pair.trim().split("/");
    if (category && slug) targetPairs.push({ category, slug });
  }
} else if (categoryArg) {
  // --category 유산균 → 해당 카테고리 spoke-index 전체
  // spoke-index가 아직 없을 수 있으니 일단 카테고리만 기록
  targetPairs = [{ category: categoryArg, slug: "*" }];
} else {
  // git diff로 data/articles/ 변경 파일 감지
  console.log("🔍 git diff로 변경된 spoke 감지 중...");
  try {
    const diff = execSync(
      "git diff --name-only HEAD && git diff --cached --name-only HEAD",
      { cwd: ROOT }
    )
      .toString()
      .split("\n")
      .filter(Boolean);

    // data/articles/{카테고리}-{N}.ts 형식 추출
    // spoke-index.json에서 slug를 역으로 매핑해야 하므로 카테고리 이름만 추출
    const changedCategories = new Set();
    for (const f of diff) {
      const m = f.match(/data\/articles\/([^/]+)\.ts$/);
      if (m) changedCategories.add(m[1]);
    }

    if (changedCategories.size === 0) {
      console.log("⚠️  변경된 article 파일 없음. --category 또는 --slugs를 직접 지정하세요.");
      process.exit(0);
    }

    console.log(`📂 변경 감지 카테고리: ${[...changedCategories].join(", ")}`);
    for (const cat of changedCategories) {
      targetPairs.push({ category: cat, slug: "*" });
    }
  } catch {
    console.error("❌ git diff 실패. git 저장소가 맞는지 확인하세요.");
    process.exit(1);
  }
}

// ── Step 1: generate-article-json.mjs (전체 JSON 갱신) ─
console.log("\n📦 article JSON 갱신 중...");
execSync("node scripts/generate-article-json.mjs", {
  cwd: ROOT,
  stdio: "inherit",
});

// ── Step 2: spoke-index.json 필터링 ────────────────────
if (!existsSync(SPOKE_INDEX)) {
  console.error("❌ spoke-index.json 없음. generate-article-json.mjs가 실패한 것 같아요.");
  process.exit(1);
}

const fullIndex = JSON.parse(readFileSync(SPOKE_INDEX, "utf-8"));
copyFileSync(SPOKE_INDEX, SPOKE_INDEX_BAK); // 백업

let filteredIndex = {};

for (const { category, slug } of targetPairs) {
  if (!fullIndex[category]) {
    console.warn(`⚠️  카테고리 '${category}'가 spoke-index에 없어요.`);
    continue;
  }
  if (slug === "*") {
    // 카테고리 전체
    filteredIndex[category] = fullIndex[category];
  } else {
    if (!filteredIndex[category]) filteredIndex[category] = {};
    if (fullIndex[category][slug]) {
      filteredIndex[category][slug] = fullIndex[category][slug];
    } else {
      console.warn(`⚠️  slug '${category}/${slug}'가 spoke-index에 없어요.`);
    }
  }
}

const totalSpokes = Object.values(filteredIndex).reduce(
  (s, v) => s + Object.keys(v).length,
  0
);

if (totalSpokes === 0) {
  console.error("❌ 빌드할 spoke가 없어요.");
  // 백업 복원
  copyFileSync(SPOKE_INDEX_BAK, SPOKE_INDEX);
  process.exit(1);
}

console.log(`\n🎯 부분 빌드 대상: ${totalSpokes}개 spoke`);
for (const [cat, slugs] of Object.entries(filteredIndex)) {
  console.log(`   ${cat}: ${Object.keys(slugs).join(", ")}`);
}

writeFileSync(SPOKE_INDEX, JSON.stringify(filteredIndex), "utf-8");

// ── Step 3: next build ──────────────────────────────────
let buildOk = false;
try {
  console.log("\n🔨 next build (부분) 시작...\n");
  execSync("npx next build", { cwd: ROOT, stdio: "inherit" });
  buildOk = true;
} catch (e) {
  console.error("\n❌ next build 실패");
} finally {
  // ── Step 4: spoke-index.json 복원 (반드시 실행) ──────
  copyFileSync(SPOKE_INDEX_BAK, SPOKE_INDEX);
  console.log("\n✅ spoke-index.json 복원 완료");
}

if (!buildOk) process.exit(1);

console.log(`
✅ 부분 빌드 완료!
   out/{카테고리}/{slug}/index.html 로 결과 확인 가능

⚠️  Cloudflare 배포는 전체 빌드가 필요해요:
   npm run build  →  git push
`);
