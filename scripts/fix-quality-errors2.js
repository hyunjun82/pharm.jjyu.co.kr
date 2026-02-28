/**
 * fix-quality-errors2.js
 * 남은 19개 오류 수정:
 * - 두타스테리드 정/캡슐의 "올바른 복용법", "효능과 효과" 2문단 → 3문단
 * - 다모실겔5%의 "보관법" 2문단 → 3문단
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../data/articles/탈모.ts");
let content = fs.readFileSync(filePath, "utf8");

const extraParagraphMap = {
  "올바른 복용법": "다른 약과 상호작용이 있을 수 있으니 복용 중인 약이 있으면 의사·약사와 상담하세요. 처방전 없이 복용량을 임의로 조절하지 않아요.",
  "효능과 효과": "임상 연구에서 꾸준히 복용 시 탈모 진행을 효과적으로 억제하는 것으로 확인되었어요. 개인차가 있으므로 효과가 나타나지 않으면 의사와 상담하세요.",
  "보관법": "개봉 후에는 뚜껑을 잘 닫아 보관하세요. 유통기한이 지난 제품은 사용하지 않아요.",
};

let fixCount = 0;

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

  const paraCount = contentStr.split("\\n\\n").length;
  if (paraCount >= 3) return match;

  const extra = extraParagraphMap[secType];
  fixCount++;
  return '{ title: "' + title + '", content: "' + contentStr + "\\n\\n" + extra + '" }';
});

if (fixCount > 0) {
  console.log("[2문단 → 3문단 확장] " + fixCount + "건");
  fs.writeFileSync(filePath, content, "utf8");
} else {
  console.log("[2문단 → 3문단] 처리 없음 (inline 패턴)");

  // 다모실겔5% 보관법 직접 수정 시도
  const target = '"다모실겔5% 보관법", content: "';
  const idx = content.indexOf(target);
  if (idx !== -1) {
    const start = idx + target.length;
    const end = content.indexOf('" }', start);
    if (end !== -1) {
      const currentContent = content.substring(start, end);
      const paraCount = currentContent.split("\\n\\n").length;
      console.log("다모실겔5% 보관법 문단 수:", paraCount, "현재 내용:", currentContent.substring(0, 100));
      if (paraCount < 3) {
        const newCont = currentContent + "\\n\\n개봉 후에는 뚜껑을 잘 닫아 보관하세요. 유통기한이 지난 제품은 사용하지 않아요.";
        content = content.substring(0, start) + newCont + content.substring(end);
        fs.writeFileSync(filePath, content, "utf8");
        console.log("다모실겔5% 보관법 수정 완료");
      }
    }
  }
}
