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
const OUT_DIR = join(__dirname, "..", "out");

let deleted = 0;

function cleanDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      cleanDir(fullPath);
    } else if (entry.endsWith(".txt") && !entry.startsWith("robots")) {
      unlinkSync(fullPath);
      deleted++;
    }
  }
}

console.log("🧹 out/ 폴더에서 불필요한 .txt 파일 삭제 중...");
cleanDir(OUT_DIR);
console.log(`✅ ${deleted}개 .txt 파일 삭제 완료`);
