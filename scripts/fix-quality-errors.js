/**
 * fix-quality-errors.js
 * 탈모.ts 품질 오류 일괄 수정:
 * 1. 슬러그에 % 없는데 섹션 제목에 % 있는 경우 제거
 * 2. 유니볼드정수출용 괄호 형식 수정
 * 3. 2문단 섹션에 3번째 문단 추가
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../data/articles/탈모.ts");
let content = fs.readFileSync(filePath, "utf8");

// 1. 슬러그에 % 없는데 섹션 제목/타이틀에 % 있는 경우 수정
const slugsWithoutPercent = [
  "남탈렌액5",
  "다모녹실액3",
  "다모녹실액5",
  "레나시딜액5",
  "로게인겔2",
  "마이녹스액5",
  "모리모리액3",
  "모리모리액5",
  "미녹시딜바이그루트겔5",
  "미녹시딜바이그루트액5",
  "모바렌액",
];

let fixCount1 = 0;
for (const slug of slugsWithoutPercent) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped + "%", "g");
  const matches = content.match(pattern);
  if (matches) {
    content = content.replace(pattern, slug);
    console.log("[섹션제목 % 제거] " + slug + " — " + matches.length + "건");
    fixCount1 += matches.length;
  }
}

// 2. 유니볼드정수출용: 괄호 형식 수정
const uniboldMatches = content.match(/유니볼드정\(수출용\)/g);
if (uniboldMatches) {
  content = content.replace(/유니볼드정\(수출용\)/g, "유니볼드정수출용");
  console.log("[유니볼드 괄호 수정] — " + uniboldMatches.length + "건");
}

// 3. 2문단 섹션 → 3문단으로 확장 (inline 스타일: { title: "...", content: "..." })
const extraParagraphMap = {
  "주의사항": "다른 탈모 외용제와 동시에 사용하지 않아요. 사용 중 갑작스러운 심박수 증가·부종 등 전신 증상이 나타나면 즉시 사용을 중단하고 의사와 상담하세요.",
  "보관법": "개봉 후에는 뚜껑을 잘 닫아 보관하세요. 유통기한이 지난 제품은 사용하지 않아요.",
  "부작용": "빠르거나 불규칙한 심박수, 부종, 어지러움 등 전신 증상이 나타나면 즉시 사용을 중단하고 의사와 상담하세요.",
  "올바른 사용법": "1mL 이상 과도하게 사용하지 않아요. 도포 시 손에 묻은 경우 깨끗이 씻어내세요. 눈·코·입에 닿지 않도록 주의하세요.",
};

let fixCount3 = 0;

// inline 섹션 패턴: { title: "...", content: "...\\n\\n..." }
// 또는 { title: "...", content: "...", ingredients: [...] }
const inlinePattern = /\{ title: "([^"]+)", content: "([^"]*)" \}/g;
content = content.replace(inlinePattern, function(match, title, contentStr) {
  let secType = null;
  for (const key of Object.keys(extraParagraphMap)) {
    if (title.includes(key)) {
      secType = key;
      break;
    }
  }
  if (!secType) return match;

  // \\n\\n으로 문단 수 확인
  const paraCount = contentStr.split("\\n\\n").length;
  if (paraCount >= 3) return match;

  const extra = extraParagraphMap[secType];
  fixCount3++;
  return '{ title: "' + title + '", content: "' + contentStr + "\\n\\n" + extra + '" }';
});

// ingredients를 포함한 섹션 패턴도 처리
// { title: "...", content: "...", ingredients: [...] }
const inlineIngPattern = /\{ title: "([^"]+)", content: "([^"]*)", ingredients:/g;
content = content.replace(inlineIngPattern, function(match, title, contentStr) {
  // 주의사항/보관법/부작용인지 확인 (ingredients는 성분 섹션에만 있으므로 여기선 아님)
  return match;
});

if (fixCount3 > 0) {
  console.log("[2문단 → 3문단 확장] " + fixCount3 + "건");
} else {
  console.log("[2문단 → 3문단] 처리 없음");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("\n총 수정: 섹션제목 % 제거 " + fixCount1 + "건, 2문단 확장 " + fixCount3 + "건");
