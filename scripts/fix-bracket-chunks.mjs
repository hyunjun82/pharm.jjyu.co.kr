/**
 * fix-bracket-chunks.mjs
 *
 * Cloudflare Pages는 [bracket] 디렉토리를 정적 파일로 서빙하지 못한다.
 * 이 스크립트는:
 * 1. bracket 디렉토리를 안전한 이름으로 rename (__category__ 등)
 * 2. 모든 JS 파일에서 bracket 경로 참조를 새 이름으로 교체
 */

import fs from 'fs';
import path from 'path';

const ASSETS_DIR = '.open-next/assets/_next/static/chunks';
const APP_DIR = path.join(ASSETS_DIR, 'app');

// bracket을 안전한 이름으로 변환: [category] -> __category__
function toSafeName(name) {
  return name.replace(/\[/g, '__').replace(/\]/g, '__');
}

// 디렉토리 내 모든 bracket 디렉토리를 재귀적으로 rename
function renameBracketDirs(baseDir) {
  if (!fs.existsSync(baseDir)) {
    console.log(`⚠ ${baseDir} 없음 → 스킵`);
    return;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    const fullPath = path.join(baseDir, dirName);

    // 먼저 하위 디렉토리 재귀 처리
    renameBracketDirs(fullPath);

    // bracket 디렉토리 rename
    if (dirName.includes('[') && dirName.includes(']')) {
      const safeName = toSafeName(dirName);
      const newPath = path.join(baseDir, safeName);

      if (fs.existsSync(newPath)) {
        fs.rmSync(newPath, { recursive: true });
      }

      fs.renameSync(fullPath, newPath);
      console.log(`📁 ${dirName} → ${safeName}`);
    }
  }
}

// 모든 JS 파일에서 bracket 경로 참조를 교체
function fixJsReferences(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      fixJsReferences(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // [category] -> __category__
      // [slug] -> __slug__
      // 등 모든 bracket 패턴 교체
      const bracketPattern = /\[([a-zA-Z0-9_-]+)\]/g;
      
      // app/[category]/page 형태의 경로 참조 교체
      const newContent = content.replace(
        /app\/\[([a-zA-Z0-9_-]+)\]/g,
        (match, name) => `app/__${name}__`
      );

      // %5B...%5D 형태도 교체
      const finalContent = newContent.replace(
        /app\/%5B([a-zA-Z0-9_-]+)%5D/gi,
        (match, name) => `app/__${name}__`
      );

      if (finalContent !== content) {
        fs.writeFileSync(fullPath, finalContent, 'utf8');
        changed = true;
        console.log(`✏️  ${entry.name} 경로 참조 수정`);
      }
    }
  }
}

console.log('🔧 Bracket chunk 경로 수정 시작...');
console.log('');

// Step 1: JS 파일의 참조를 먼저 수정
console.log('Step 1: JS 참조 수정');
fixJsReferences(ASSETS_DIR);
console.log('');

// Step 2: bracket 디렉토리 rename
console.log('Step 2: 디렉토리 rename');
renameBracketDirs(APP_DIR);
console.log('');

console.log('✅ Bracket chunk 경로 수정 완료');
