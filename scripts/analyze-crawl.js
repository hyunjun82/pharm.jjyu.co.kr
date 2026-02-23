const fs = require("fs");
const data = JSON.parse(fs.readFileSync("scripts/barkiri-products.json", "utf8"));

console.log("=== 발키리 전체 제품 수집 결과 ===");
console.log("전체:", data.length, "개\n");

const types = {};
data.forEach((p) => { types[p.type] = (types[p.type] || 0) + 1; });
Object.entries(types).forEach(([k, v]) => console.log("  " + k + ": " + v + "개"));

const valid = data.filter((p) => p.name !== "에러" && p.name !== "알 수 없음");
console.log("\n유효 제품:", valid.length, "개\n");

const categories = {
  탈모: ["미녹시딜", "탈모", "프로페시아", "피나스테리드", "모모페시아", "판토가", "케라민", "헤어그로", "다모다트", "아보다트", "로게인", "마이페시아", "알로시아", "알로스칸", "바로피나", "피나원", "피나시드", "케라시딜", "케이녹시", "모나드", "베아리모", "미노페시아", "피나테드", "피나테크"],
  연고: ["연고", "크림", "겔", "밴드", "반창고", "오라메디", "마데카솔", "후시딘", "비판텐", "복합마데카솔", "에스로반", "베아로반", "테라마이신", "박트로반", "겐타마이신"],
  감기: ["감기", "콘택", "판콜", "타이레놀", "테라플루", "코데", "코푸", "화이투벤", "펜잘", "쌍화", "루루"],
  진통제: ["이부프로펜", "아스피린", "애드빌", "탁센", "이지엔", "게보린", "사리돈", "낙센"],
  무좀: ["무좀", "라미실", "카네스텐", "터비뉴", "피부사상균"],
  설사: ["설사", "정로환", "스멕타", "로페라", "비코그린"],
  소화제: ["소화", "베아제", "훼스탈", "까스활명수", "개비스콘", "겔포스", "알마겔", "위청수", "인사돌"],
  안약: ["안약", "점안", "아이봉", "인공눈물", "히알루"],
};

const categorized = {};
const uncategorized = [];

for (const p of valid) {
  let found = false;
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => p.name.includes(kw))) {
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(p);
      found = true;
      break;
    }
  }
  if (!found) uncategorized.push(p);
}

console.log("=== 카테고리별 제품 수 ===");
for (const [cat, items] of Object.entries(categorized)) {
  const otc = items.filter((i) => i.type === "일반").length;
  const rx = items.filter((i) => i.type === "전문").length;
  const etc = items.filter((i) => i.type === "미분류").length;
  console.log(`  ${cat}: ${items.length}개 (일반:${otc} 전문:${rx} 미분류:${etc})`);
}
console.log(`  미분류: ${uncategorized.length}개`);

console.log("\n=== 미분류 주요 제품군 (추가 카테고리 후보) ===");
const extraCats = {
  "비타민/영양제": ["비타민", "임팩타민", "엑셀비타", "센시아", "아로나민", "텐텐", "마그비", "프리미엄정"],
  "피임약/여성": ["센스데이", "머시론", "센스리베", "그날엔", "미니보라"],
  "변비약": ["둘코락스", "비코솔", "둘코소프트"],
  "파스/외용제": ["신신파스", "케펨", "살론파스", "제통", "제놀", "플라스타"],
  "구강/치과": ["오라비텐", "가그린", "잇치", "이가탄"],
  "해열/소아": ["부루펜", "맥시부펜", "챔프", "맥시부"],
  "간장약/우루사": ["우루사"],
  "피부/아토피": ["콜로덤", "아토"],
  "알레르기": ["알레르기", "지르텍", "클라리틴"],
  "유산균": ["프로바이오틱스", "유산균", "락토"],
};

for (const [cat, kws] of Object.entries(extraCats)) {
  const matched = uncategorized.filter((p) => kws.some((kw) => p.name.includes(kw)));
  if (matched.length > 0) {
    console.log(`\n  📦 ${cat}: ${matched.length}개`);
    matched.slice(0, 5).forEach((p) => {
      const price = p.price ? ` (${p.price.toLocaleString()}원~)` : "";
      console.log(`    → ${p.id.padEnd(7)} ${p.name}${price}`);
    });
    if (matched.length > 5) console.log(`    ... 외 ${matched.length - 5}개`);
  }
}

// 우리 사이트 기존 제품과 발키리 매칭 확인
console.log("\n=== 기존 사이트 제품 딥링크 검증 ===");
const ourProducts = [
  { name: "마데카솔", id: "p104" },
  { name: "후시딘", id: "p93" },
  { name: "비판텐", id: "p97" },
  { name: "미녹시딜", id: "p135" },
  { name: "판콜에이", id: "p13" },
  { name: "라미실", id: "p281" },
  { name: "타이레놀", id: "p88" },
  { name: "이부프로펜(탁센400)", id: "p1122" },
  { name: "콘택골드", id: "p442" },
  { name: "콘택600", id: null },
];

for (const op of ourProducts) {
  if (!op.id) {
    console.log(`  ❌ ${op.name}: 딥링크 없음 (검색 fallback)`);
    continue;
  }
  const found = data.find((p) => p.id === op.id);
  if (found) {
    console.log(`  ✅ ${op.name} → ${op.id} = "${found.name}" (${found.price ? found.price.toLocaleString() + "원~" : "가격미확인"})`);
  } else {
    console.log(`  ❌ ${op.name} → ${op.id} 발키리에서 찾을 수 없음`);
  }
}
