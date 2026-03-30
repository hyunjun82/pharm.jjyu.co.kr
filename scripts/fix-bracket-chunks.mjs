/**
 * fix-bracket-chunks.mjs
 *
 * Cloudflare Pages는 정적 파일 경로의 [bracket]을 동적 라우트로 해석해서 404를 반환함.
 * 이 스크립트는 OpenNext 빌드 후 bracket 디렉토리의 파일을 URL-encoded 이름으로 복사함.
 *
 * 예: app/[category]/page-xxx.js → app/%5Bcategory%5D/page-xxx.js
 */

import fs from 'fs';
import path from 'path';

const ASSETS_DIR = '.open-next/assets/_next/static/chunks/app';

function copyBracketDirs(baseDir) {
  if (!fs.existsSync(baseDir)) {
    console.log(`⚠️ ${baseDir} 없음 — 스킵`);
    return;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    // [category] 같은 bracket 디렉토리 찾기
    if (dirName.startsWith('[') && dirName.endsWith(']')) {
      const encoded = dirName.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
      const srcPath = path.join(baseDir, dirName);
      const dstPath = path.join(baseDir, encoded);

      // URL-encoded 이름으로 복사
      fs.cpSync(srcPath, dstPath, { recursive: true });
      console.log(`✅ ${dirName} → ${encoded}`);

      // 하위 디렉토리도 재귀 처리
      copyBracketDirs(path.join(baseDir, encoded));
    }

    // 원본 bracket 디렉토리 내부도 재귀 처리
    copyBracketDirs(path.join(baseDir, dirName));
  }
}

console.log('🔧 Bracket chunk 경로 수정 시작...');
copyBracketDirs(ASSETS_DIR);
console.log('✅ Bracket chunk 경로 수정 완료');
