/**
 * count-accurate.js
 * 각 카테고리 articles 파일의 정확한 hub.spokes, spokes 객체 수 카운트
 */
const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "../data/articles");

const categories = [
  "연고", "감기", "진통제", "무좀", "탈모",
  "설사", "소화제", "안약", "구강", "파스",
  "영양제", "여성건강", "외상소독", "두드러기",
  "구충제", "변비", "알레르기", "제산제"
];

console.log("카테고리 | hub.spokes | spokes객체 | 차이");
console.log("---------|-----------|-----------|-----");

for (const cat of categories) {
  const filePath = path.join(ARTICLES_DIR, `${cat}.ts`);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // 1. hub.spokes 배열 범위 찾기
  let hubSpokesStart = -1;
  let hubSpokesEnd = -1;
  let depth = 0;
  let inHubSpokes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inHubSpokes && line.includes("spokes: [") && hubSpokesStart === -1) {
      // hub.spokes 배열 시작 - export const spokes 이전에만
      const exportSpokesLine = lines.findIndex(l => l.includes("export const spokes"));
      if (exportSpokesLine === -1 || i < exportSpokesLine) {
        hubSpokesStart = i;
        inHubSpokes = true;
        depth = 1;
      }
    } else if (inHubSpokes) {
      for (const ch of line) {
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            hubSpokesEnd = i;
            inHubSpokes = false;
            break;
          }
        }
      }
    }
  }

  let hubCount = 0;
  if (hubSpokesStart !== -1 && hubSpokesEnd !== -1) {
    const hubSlugLines = lines.slice(hubSpokesStart, hubSpokesEnd + 1)
      .filter(l => /^\s+slug:\s*"/.test(l));
    hubCount = hubSlugLines.length;
  }

  // 2. spokes 객체에서 최상위 키 수 카운트
  const exportSpokesIdx = lines.findIndex(l => l.includes("export const spokes"));
  let spokesCount = 0;

  if (exportSpokesIdx !== -1) {
    // spokes 객체 시작 후, depth=1에서 나타나는 "key: {" 또는 "  key: {" 패턴
    let sd = 0;
    for (let i = exportSpokesIdx; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === "{") sd++;
        else if (ch === "}") sd--;
      }
      // depth=1일 때 키:{ 패턴 (최상위 키)
      // depth가 1이 된 직후 라인들에서 key: { 패턴
      if (sd === 1 && i > exportSpokesIdx) {
        // 이 라인이 depth 1인 상태에서 나온 키인지 확인
      }
    }

    // 더 간단한 방법: export const spokes = { 이후 depth 2에서 slug: 를 카운트
    // 또는 spokes 객체 내에서 top-level key 패턴 찾기
    // 패턴: 4~6 spaces + 한글/영어 식별자 + ": {"
    let inSpokesObj = false;
    let sDepth = 0;

    for (let i = exportSpokesIdx; i < lines.length; i++) {
      const line = lines[i];

      if (i === exportSpokesIdx) {
        inSpokesObj = true;
        // { count
        for (const ch of line) {
          if (ch === "{") sDepth++;
          else if (ch === "}") sDepth--;
        }
        continue;
      }

      if (!inSpokesObj) break;

      const prevDepth = sDepth;
      for (const ch of line) {
        if (ch === "{") sDepth++;
        else if (ch === "}") sDepth--;
      }

      // depth가 2가 되는 순간 (top-level 객체 키 진입)
      if (prevDepth === 1 && sDepth === 2) {
        spokesCount++;
      }

      if (sDepth <= 0) break;
    }
  }

  const diff = spokesCount - hubCount;
  const mark = diff > 0 ? `❌ +${diff}` : "✅";
  console.log(`${cat.padEnd(8)} | ${String(hubCount).padStart(9)} | ${String(spokesCount).padStart(9)} | ${mark}`);
}
