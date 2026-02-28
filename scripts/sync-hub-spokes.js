/**
 * sync-hub-spokes.js
 * 모든 카테고리 articles 파일에서 hub.spokes 배열과 spokes 객체를 동기화
 * spokes 객체에 있지만 hub.spokes 배열에 없는 항목을 자동 추가
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

function processCategory(cat) {
  const filePath = path.join(ARTICLES_DIR, `${cat}.ts`);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // 1. spokes 객체에서 모든 최상위 slug 추출 (unquoted key 형식)
  const exportSpokesIdx = lines.findIndex(l => l.includes("export const spokes"));
  if (exportSpokesIdx === -1) {
    console.log(`[${cat}] spokes 객체 없음`);
    return;
  }

  // spokes 객체 내 top-level 키와 각 항목의 title, description 추출
  const spokesMap = new Map(); // slug -> { title, description }
  let sDepth = 0;
  let currentSlug = null;
  let currentTitle = null;
  let currentDesc = null;

  for (let i = exportSpokesIdx; i < lines.length; i++) {
    const line = lines[i];
    const prevDepth = sDepth;

    for (const ch of line) {
      if (ch === "{") sDepth++;
      else if (ch === "}") sDepth--;
    }

    // depth 1→2: 새 top-level 항목 시작
    if (prevDepth === 1 && sDepth === 2) {
      // 이전 항목 저장
      if (currentSlug) {
        spokesMap.set(currentSlug, {
          title: currentTitle || `${currentSlug} 성분 효과 | 사용법 부작용 총정리`,
          description: currentDesc || `${currentSlug}의 성분, 효과, 사용법, 부작용 정보`
        });
      }
      currentSlug = null;
      currentTitle = null;
      currentDesc = null;
    }

    // depth 2에서 slug, title, description 추출
    if (sDepth >= 2) {
      const slugM = line.match(/^\s+slug:\s*"([^"]+)"/);
      if (slugM) currentSlug = slugM[1];

      const titleM = line.match(/^\s+title:\s*"([^"]+)"/);
      if (titleM) currentTitle = titleM[1];

      const descM = line.match(/^\s+description:\s*"([^"]+)"/);
      if (descM) currentDesc = descM[1];
    }

    // depth 2→1: 항목 종료
    if (prevDepth === 2 && sDepth === 1) {
      if (currentSlug) {
        spokesMap.set(currentSlug, {
          title: currentTitle || `${currentSlug} 성분 효과 | 사용법 부작용 총정리`,
          description: currentDesc || `${currentSlug}의 성분, 효과, 사용법, 부작용 정보`
        });
        currentSlug = null;
        currentTitle = null;
        currentDesc = null;
      }
    }

    if (sDepth <= 0 && i > exportSpokesIdx) break;
  }

  if (spokesMap.size === 0) {
    console.log(`[${cat}] spokes 항목 없음`);
    return;
  }

  // 2. hub.spokes 배열에서 기존 slug 추출
  // export const spokes 이전에 있는 spokes: [ 를 찾음
  let hubSpokesLineIdx = -1;
  for (let i = 0; i < exportSpokesIdx; i++) {
    if (lines[i].includes("spokes: [")) {
      hubSpokesLineIdx = i;
      break;
    }
  }

  if (hubSpokesLineIdx === -1) {
    console.log(`[${cat}] hub.spokes 배열 없음`);
    return;
  }

  // hub.spokes 배열 끝 찾기
  let hDepth = 0;
  let hubSpokesEnd = -1;
  for (let i = hubSpokesLineIdx; i < exportSpokesIdx; i++) {
    for (const ch of lines[i]) {
      if (ch === "[") hDepth++;
      else if (ch === "]") {
        hDepth--;
        if (hDepth === 0) {
          hubSpokesEnd = i;
          break;
        }
      }
    }
    if (hubSpokesEnd !== -1) break;
  }

  if (hubSpokesEnd === -1) {
    console.log(`[${cat}] hub.spokes 배열 끝 못 찾음`);
    return;
  }

  // 기존 hub slug 목록
  const existingHubSlugs = new Set();
  for (let i = hubSpokesLineIdx; i <= hubSpokesEnd; i++) {
    const slugM = lines[i].match(/^\s+slug:\s*"([^"]+)"/);
    if (slugM) existingHubSlugs.add(slugM[1]);
  }

  // 3. 누락된 slug 계산 (spokes 객체 순서 유지)
  const missingSlugs = [...spokesMap.keys()].filter(s => !existingHubSlugs.has(s));

  if (missingSlugs.length === 0) {
    console.log(`[${cat}] ✅ 동기화 완료 (${spokesMap.size}개)`);
    return;
  }

  console.log(`[${cat}] 누락 ${missingSlugs.length}개 추가 중...`);

  // 4. 삽입할 텍스트 생성
  const indent = "      "; // 6 spaces (hub.spokes 배열 내부 들여쓰기)
  const newEntries = missingSlugs.map(slug => {
    const { title, description } = spokesMap.get(slug);
    return [
      `${indent}{`,
      `${indent}  slug: "${slug}",`,
      `${indent}  title: "${title}",`,
      `${indent}  description: "${description}",`,
      `${indent}},`
    ].join("\n");
  }).join("\n");

  // 5. hub.spokes 배열 닫는 ] 바로 앞에 삽입
  // hubSpokesEnd 줄이 ], 를 포함하는 줄
  const closingLine = lines[hubSpokesEnd];
  const closingIndent = closingLine.match(/^(\s*)/)[1];

  // 새 줄 목록 구성
  const newLines = [
    ...lines.slice(0, hubSpokesEnd),
    newEntries,
    ...lines.slice(hubSpokesEnd)
  ];

  fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
  console.log(`[${cat}] ✅ ${missingSlugs.length}개 추가 완료 → 총 ${spokesMap.size}개`);
}

// 모든 카테고리 처리
for (const cat of categories) {
  try {
    processCategory(cat);
  } catch (e) {
    console.error(`[${cat}] 오류: ${e.message}`);
    console.error(e.stack);
  }
}

console.log("\n동기화 완료!");
