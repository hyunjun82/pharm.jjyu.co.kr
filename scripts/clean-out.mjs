/**
 * 빌드 후 out/ 폴더에서 불필요한 .txt 파일 삭제
 * Cloudflare Pages 20,000 파일 제한 대응
 * Next.js 16 SSG가 RSC용 .txt 파일을 대량 생성하는데, 정적 배포에는 불필요
 */
import { readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", process.argv[2] || "out");

let deleted = 0;

function cleanDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      cleanDir(fullPath);
    } else if (entry.endsWith(".txt") && !entry.startsWith("robots") && entry !== "9c135131626d49088fa4bfff9b5e8672.txt") {
      // ↑ IndexNow 키 파일은 절대 삭제 금지 (2026-07-19 실측: 이 스크립트가 키 파일까지 지워
      //   라이브 404 → 빙·네이버가 IndexNow 통지 전부 무시하는 사고 발견. 키 404면 프로토콜상 통지 무효)
      unlinkSync(fullPath);
      deleted++;
    }
  }
}

console.log("🧹 out/ 폴더에서 불필요한 .txt 파일 삭제 중...");
cleanDir(OUT_DIR);
console.log(`✅ ${deleted}개 .txt 파일 삭제 완료`);
