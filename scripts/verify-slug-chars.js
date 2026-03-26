/**
 * slug/Record 키에 URL-unsafe 문자(%, #, ? 등)가 포함되었는지 검사
 * postbuild에서 자동 실행되어 재발 방지
 */

const fs = require("fs");
const path = require("path");

const UNSAFE_CHARS = /[%#?&=]/;
const articlesDir = path.join(__dirname, "..", "data", "articles");
let errors = 0;

const files = fs.readdirSync(articlesDir).filter(f => f.endsWith(".ts"));

for (const file of files) {
  const content = fs.readFileSync(path.join(articlesDir, file), "utf-8");
  // Record 키 패턴: "키이름": { 또는 "키이름" : {
  const keyPattern = /"([^"]+)"\s*:\s*\{/g;
  let match;
  while ((match = keyPattern.exec(content)) !== null) {
    const key = match[1];
    if (UNSAFE_CHARS.test(key)) {
      console.error(`❌ ${file}: Record 키 "${key}" 에 URL-unsafe 문자 포함`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n⚠️ ${errors}개 Record 키에 URL-unsafe 문자 발견 — slug에서 %, #, ?, & 제거 필요`);
  process.exit(1);
} else {
  console.log(`✅ slug 문자 검증 통과 (${files.length}개 파일)`);
}
