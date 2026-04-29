import { useState } from "react";

// ── 아이콘 ────────────────────────────────────────────────────
const Icons = {
  ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronDown: ({ open }) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>,
  Pill: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>,
  Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
  ClipboardList: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>,
  ShieldAlert: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  PackageOpen: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-9"/><path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8 15 3 12.57a1.93 1.93 0 0 1 0-3.36z"/><path d="M3.58 6.98L12 2l8.42 4.98"/><path d="M21 12v5a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 17v-5"/></svg>,
  BadgePercent: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="9" x2="15" y1="15" y2="9"/><circle cx="9.5" cy="9.5" r=".5" fill="currentColor"/><circle cx="14.5" cy="14.5" r=".5" fill="currentColor"/></svg>,
  Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
  Database: () => <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>,
};

function getSectionIcon(title) {
  if (title.includes("성분")) return { Icon: Icons.Pill, color: "#3b82f6", bg: "#eff6ff" };
  if (title.includes("효과") || title.includes("효능")) return { Icon: Icons.Sparkles, color: "#f59e0b", bg: "#fffbeb" };
  if (title.includes("복용법") || title.includes("사용법")) return { Icon: Icons.ClipboardList, color: "#10b981", bg: "#f0fdf4" };
  if (title.includes("가격") || title.includes("최저가")) return { Icon: Icons.BadgePercent, color: "#059669", bg: "#ecfdf5" };
  if (title.includes("주의사항")) return { Icon: Icons.ShieldAlert, color: "#f97316", bg: "#fff7ed" };
  if (title.includes("보관")) return { Icon: Icons.PackageOpen, color: "#8b5cf6", bg: "#f5f3ff" };
  return { Icon: Icons.ClipboardList, color: "#9ca3af", bg: "#f9fafb" };
}

// ── 5개 아티클 데이터 ─────────────────────────────────────────
const articles = [
  {
    slug: "뉴트리원프로바이오틱스",
    label: "뉴트리원", badge: "100억 단일",
    h1: "뉴트리원 프로바이오틱스 최저가 가격 | 성분 효과 복용법 부작용까지",
    heroDescription: "아연이나 비타민D 같은 추가 성분 없이 유산균 100억 CFU에만 집중한 제품을 찾는 분들이 뉴트리원 프로바이오틱스를 선택해요. 콜마비앤에이치(주)에서 만드는 이 제품은 캡슐 1개(450mg)에 프로바이오틱스 100억 CFU를 담은 단일 구성이에요. 복합 기능성 제품보다 유산균 본연의 효과에 집중하고 싶은 분에게 맞는 선택이에요.",
    productName: "뉴트리원 프로바이오틱스 60캡슐", productDesc: "프로바이오틱스 100억 CFU 단일 구성. 복합 성분 없이 유산균 기능성에 집중한 캡슐형.",
    externalSearchUrl: "https://search.shopping.naver.com/search/all?query=뉴트리원+프로바이오틱스",
    ingredients: [{ type:"주성분", name:"프로바이오틱스", amount:"100억 CFU/450mg", role:"유산균 증식·유해균 억제, 배변활동 원활, 장 건강" }],
    sections: [
      { title:"뉴트리원 프로바이오틱스 성분은 무엇인가요?", content:"캡슐 1개(450mg)에 프로바이오틱스 100억 CFU가 담겨 있어요. 아연·비타민D처럼 추가 영양소 없이 프로바이오틱스 단일 구성이에요. 다른 복합 제품보다 성분이 단순한 대신, 유산균 본연의 기능성에 집중한 구성이에요.\n\n제형은 노란 하얀색 분말을 담은 투명한 경질캡슐이에요. 고유의 향미가 있고 이미·이취가 없는 것이 정품 기준이에요. 대장균군 음성, 붕해 20분 이내 기준을 통과한 제품이에요.\n\n식약처 프로바이오틱스 함량 기준(1억~1,000억 CFU) 안에서 100억 CFU는 중상위 함량이에요. 아연이나 비타민D를 별도 보충제로 이미 챙기고 있다면, 유산균만 단독으로 섭취하는 이 제품이 영양소 과잉을 막는 데 유리해요.", hasIngredients: true },
      { title:"뉴트리원 프로바이오틱스 효과가 나타나려면 얼마나 걸리나요?", content:"식약처가 인정한 기능성은 세 가지예요. ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강에 도움이에요. 아연이나 비타민D가 추가된 복합 제품과 달리 장 건강 3가지에만 집중된 기능성 구성이에요.\n\n배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 처음 1~2주에 가스가 늘거나 장이 예민해지는 적응 과정이 생길 수 있어요.\n\n3개월을 효과 판단 기준으로 삼는 게 좋아요." },
      { title:"뉴트리원 프로바이오틱스 복용법은 어떻게 되나요?", content:"1일 1회, 1회 1캡슐을 물과 함께 섭취해요. 식전·식후 구분 없이 섭취 가능해요. 특이체질이나 알레르기 체질이라면 첫 섭취 전에 원료를 꼭 확인해보세요.\n\n매일 같은 시간에 빠뜨리지 않고 챙기는 게 가장 중요해요. 항생제 복용 중이라면 최소 2시간 간격을 두거나 치료 후 섭취하세요.", showPriceCTA: true },
      { title:"뉴트리원 프로바이오틱스 가격은 얼마인가요?", content:"뉴트리원 프로바이오틱스 60캡슐 기준 가격은 구매 채널마다 차이가 있어요. 아래 버튼에서 네이버 쇼핑 실시간 최저가를 직접 확인하고 비교해보세요." },
      { title:"뉴트리원 프로바이오틱스 주의사항은 무엇인가요?", content:"특이체질·알레르기 체질은 개인에 따라 과민반응이 나타날 수 있어요. 섭취 전 원료를 반드시 확인하고, 두드러기·가려움·호흡 불편 같은 증상이 생기면 즉시 중단하고 전문가와 상담하세요.\n\n질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담이 필요해요. 어린이가 하루 1캡슐 이상 섭취하지 않도록 지도하세요." },
      { title:"뉴트리원 프로바이오틱스 보관할 때 주의할 점은 무엇인가요?", content:"습기가 적고 직사광선을 받지 않는 실온에 보관해요. 유통기한은 제조일로부터 18개월이에요. 어린이 손에 닿지 않는 곳에 보관하세요.\n\n냉장 보관은 불필요하며 오히려 결로가 생길 수 있어요." },
    ],
    faq: [
      { question:"뉴트리원 프로바이오틱스 언제 먹는 게 좋나요?", answer:"식전·식후 구분 없이 1일 1회 1캡슐을 물과 함께 섭취하면 돼요. 섭취 타이밍보다 꾸준함이 훨씬 중요해요. 매일 같은 시간을 고정해두세요." },
      { question:"언제부터 효과가 나타나나요?", answer:"배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 처음 1~2주는 가스가 늘거나 장이 예민해지는 적응 과정일 수 있어요. 이 시기에 중단하면 효과를 판단하기 어려워요." },
      { question:"복합 성분 대신 단일 유산균을 선택해야 하는 경우는요?", answer:"아연이나 비타민D를 별도 보충제로 이미 챙기고 있다면 복합 제품보다 단일 유산균이 과잉 섭취를 막는 데 유리해요. 여러 영양제를 먹고 있다면 성분 겹침을 확인하고 단일 유산균을 선택하는 게 합리적이에요." },
    ],
  },
  {
    slug: "비피도라이브비피더스",
    label: "비피도라이브", badge: "장용성+아연+비타민D",
    h1: "비피도 라이브 비피더스 최저가 가격 | 성분 효과 복용법 부작용까지",
    heroDescription: "유산균이 위산을 통과하면서 살아서 장까지 도달하는지 걱정해본 적 있다면 장용성 캡슐 제품이 선택지에 오를 거예요. (주)비피도의 라이브 비피더스는 위산을 견디는 장용성 코팅 캡슐에 프로바이오틱스 100억 CFU와 아연, 비타민D까지 담았어요. 냉장 보관이 필요하다는 점이 다른 유산균과 크게 다른 부분이에요.",
    productName: "비피도 100억 라이브 비피더스 30캡슐", productDesc: "장용성 캡슐 100억 CFU + 아연 8.5mg + 비타민D 600IU. 냉장 보관 프로바이오틱스.",
    externalSearchUrl: "https://search.shopping.naver.com/search/all?query=비피도+라이브+비피더스",
    ingredients: [
      { type:"주성분", name:"프로바이오틱스", amount:"100억 CFU/500mg", role:"유산균 증식·유해균 억제, 배변활동 원활, 장 건강" },
      { type:"주성분", name:"아연", amount:"8.5mg/500mg", role:"정상적인 면역기능·세포분열에 필요한 미네랄" },
      { type:"주성분", name:"비타민D", amount:"15ug(600IU)/500mg", role:"칼슘·인 흡수, 뼈 형성·유지, 골다공증 발생 위험 감소" },
    ],
    sections: [
      { title:"비피도 라이브 비피더스 성분은 무엇인가요?", content:"캡슐 1개(500mg)에 프로바이오틱스 100억 CFU, 아연 8.5mg, 비타민D 15ug(600IU)이 함께 담겨 있어요. 프로바이오틱스만 들어있는 단일 제품들과 달리, 유산균·면역·뼈 건강을 1캡슐로 동시에 챙길 수 있어요.\n\n가장 큰 특징은 장용성 경질캡슐이에요. 위산 환경(제1액)에서 120분 이상 버티고 장 환경(제2액)에서 60분 이내 방출되는 기준을 통과해야 해요. 살아있는 유산균이 장에 더 안정적으로 도달하는 구조예요.\n\n아연 8.5mg은 성인 하루 권장 섭취량에 해당하는 양이에요. 비타민D 600IU는 한국인 영양소 섭취기준 범위 안이에요.", hasIngredients: true },
      { title:"비피도 라이브 비피더스 효과가 나타나려면 얼마나 걸리나요?", content:"식약처가 인정한 기능성은 다섯 가지예요. 프로바이오틱스로 ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강, 아연으로 ④ 정상적인 면역기능·세포분열, 비타민D로 ⑤ 칼슘·인 흡수 및 뼈 건강·골다공증 발생 위험 감소예요.\n\n장 건강 변화는 2~4주에 체감하기 시작해요. 장용성 캡슐 덕분에 위산에서 유산균 손실이 줄어 장에 더 많이 도달할 수 있어요. 면역·뼈 건강 효과는 수개월 이상 꾸준히 섭취해야 축적되는 영역이에요." },
      { title:"비피도 라이브 비피더스 복용법은 어떻게 되나요?", content:"1일 1회, 1회 1캡슐을 물과 함께 섭취해요. 냉장 보관 제품이라 꺼낸 후 바로 섭취하는 게 좋아요. 아침 냉장고를 열 때 챙기는 루틴을 만들면 빠뜨리지 않기 쉬워요.\n\n항생제 복용 중이라면 최소 2시간 이상 간격을 두거나 치료 후 섭취하세요. 고칼슘혈증이 있는 분은 비타민D 추가 섭취 전에 전문가와 상담이 필요해요.", showPriceCTA: true },
      { title:"비피도 라이브 비피더스 가격은 얼마인가요?", content:"비피도 100억 라이브 비피더스 30캡슐 기준 가격은 구매 채널마다 차이가 있어요. 아래 버튼에서 네이버 쇼핑 실시간 최저가를 직접 확인하고 비교해보세요." },
      { title:"비피도 라이브 비피더스 주의사항은 무엇인가요?", content:"질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담하세요. 특히 고칼슘혈증이 있는 분은 비타민D 섭취 전 의사 확인이 필요해요.\n\n비타민D와 아연을 별도 보충제로 이미 섭취 중이라면 하루 합산량이 상한을 넘지 않는지 확인하세요." },
      { title:"비피도 라이브 비피더스 보관할 때 주의할 점은 무엇인가요?", content:"반드시 냉장 보관해야 해요. 유통기한은 18개월이에요. 냉동 보관은 캡슐 변형 우려가 있어 피해야 해요.\n\n여행 시에는 아이스팩과 함께 보관하거나 단기간(1~2일)은 서늘한 실온도 가능하지만 가능한 냉장 유지가 원칙이에요." },
    ],
    faq: [
      { question:"냉장 보관 꼭 해야 하나요?", answer:"네, 반드시 냉장 보관해야 해요. 실온에 오래 두면 생균 수가 급격히 줄어들 수 있어요. 냉동 보관은 캡슐 변형 우려가 있어 피해야 해요." },
      { question:"언제부터 효과가 나타나나요?", answer:"장 건강 변화는 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 장용성 캡슐 덕분에 위산 손실이 줄어 같은 100억이라도 더 많은 유산균이 장에 도달해요." },
      { question:"비타민D와 아연을 따로 먹고 있는데 겹쳐도 되나요?", answer:"비타민D 하루 상한은 100ug(4,000IU), 아연은 35mg이에요. 이 제품 1캡슐에 아연 8.5mg, 비타민D 15ug(600IU)이에요. 다른 보충제와 합산해 상한을 넘지 않는지 확인 후 섭취하세요." },
    ],
  },
  {
    slug: "프롬바이오유산균",
    label: "프롬바이오", badge: "10억·여성전용",
    h1: "프롬바이오 유산균 for 우먼 최저가 가격 | 성분 효과 복용법 부작용까지",
    heroDescription: "유산균을 고를 때 나에게 맞는 균주와 함량을 찾다가 여성 전용 제품을 검색하게 되는 경우가 있어요. 프롬바이오 유산균 for 우먼은 코스맥스엔비티(주)에서 만든 여성 타겟 유산균으로, 캡슐 1개(170mg)에 프로바이오틱스 10억 CFU가 담겨 있어요. 100억 CFU 제품이 장에 부담스럽게 느껴지거나 처음 유산균을 시작하는 여성이라면 고려해볼 수 있는 저함량 제품이에요.",
    productName: "프롬바이오 유산균 for 우먼 60캡슐", productDesc: "프로바이오틱스 10억 CFU. 여성 타겟 저함량 소형 장방형 캡슐형 유산균.",
    externalSearchUrl: "https://search.shopping.naver.com/search/all?query=프롬바이오+유산균",
    ingredients: [{ type:"주성분", name:"프로바이오틱스", amount:"10억 CFU(1,000,000,000 CFU)/170mg", role:"유산균 증식·유해균 억제, 배변활동 원활, 장 건강" }],
    sections: [
      { title:"프롬바이오 유산균 for 우먼 성분은 무엇인가요?", content:"캡슐 1개(170mg)에 프로바이오틱스 10억 CFU가 담겨 있어요. 식약처 프로바이오틱스 함량 기준(1억~1,000억 CFU) 안에서 10억 CFU는 저함량 구간이에요. 100억 CFU 고함량 제품에 비해 장 적응이 부드럽고 초기 가스나 복부 팽만이 적게 나타나는 경향이 있어요.\n\n제형은 노란 하양색 분말을 담은 투명한 장방형 경질캡슐이에요. 일반 원통형 캡슐보다 납작한 장방형으로 삼키기 수월해요. 붕해 20분 이내, 대장균군 음성 기준을 통과한 제품이에요.\n\n아연·비타민D 같은 추가 성분 없이 프로바이오틱스 단일 구성이에요.", hasIngredients: true },
      { title:"프롬바이오 유산균 for 우먼 효과가 나타나려면 얼마나 걸리나요?", content:"식약처가 인정한 기능성은 세 가지예요. ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강에 도움이에요. 기능성 항목 자체는 100억 CFU 제품과 동일하지만, 함량이 낮아 장내 균총에 미치는 초기 자극이 적어요.\n\n배변 변화는 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 100억 CFU 제품에서 가스가 심했거나 장이 예민한 편이라면 10억 CFU에서 시작하는 방법도 있어요.\n\n1개월을 최소 판단 기준으로 삼고, 3개월 이상 꾸준히 챙겨봐야 해요." },
      { title:"프롬바이오 유산균 for 우먼 복용법은 어떻게 되나요?", content:"1일 1회, 1회 1캡슐을 물과 함께 섭취해요. 식전·식후 구분 없이 섭취 가능해요. 장방형 캡슐이라 물을 충분히 마시면서 섭취하세요.\n\n소비기한을 확인한 후 섭취하고, 소비기한이 지난 제품은 섭취하지 마세요. 임산부·수유부는 섭취 전에 전문가와 상담이 필요해요.", showPriceCTA: true },
      { title:"프롬바이오 유산균 for 우먼 가격은 얼마인가요?", content:"프롬바이오 유산균 for 우먼 60캡슐 기준 가격은 구매 채널마다 차이가 있어요. 아래 버튼에서 네이버 쇼핑 실시간 최저가를 직접 확인하고 비교해보세요." },
      { title:"프롬바이오 유산균 for 우먼 주의사항은 무엇인가요?", content:"질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담하세요. 알레르기 체질은 개인에 따라 과민반응이 나타날 수 있어요. 이상사례 발생 시 섭취를 중단하고 전문가에게 확인하세요." },
      { title:"프롬바이오 유산균 for 우먼 보관할 때 주의할 점은 무엇인가요?", content:"직사광선이나 고온다습한 곳을 피해 청결하고 서늘한 실온에 보관하세요. 유통기한은 제조일로부터 18개월이에요.\n\n냉장 보관은 불필요하며 오히려 결로가 생길 수 있어요." },
    ],
    faq: [
      { question:"10억 CFU가 너무 적은 건 아닌가요?", answer:"식약처 프로바이오틱스 기능성 인정 기준은 1억~1,000억 CFU예요. 10억 CFU도 기준 내에 있어 기능성을 충족해요. 100억 CFU 제품에서 가스·복부 팽만이 심했던 분이나 처음 시작하는 분에게는 낮은 함량에서 시작하는 게 유리할 수 있어요." },
      { question:"언제부터 효과가 나타나나요?", answer:"배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 함량이 10억으로 낮아 100억 제품보다 초기 장내 변화 속도가 다를 수 있어요. 1개월 이상 챙긴 뒤 효과를 판단하세요." },
      { question:"3개월 이상 먹었는데 효과가 없으면요?", answer:"10억 CFU로 3개월 이상 효과가 없었다면 함량을 높인 제품으로 바꾸는 것을 고려해볼 수 있어요. 식이섬유, 수분, 운동량도 함께 점검해보세요." },
    ],
  },
  {
    slug: "닥터린유산균",
    label: "닥터린", badge: "100억·소형캡슐",
    h1: "닥터린 유산균 최저가 가격 | 성분 효과 복용법 부작용까지",
    heroDescription: "캡슐형 유산균 100억 CFU를 찾는데 캡슐 크기가 부담스럽다는 분들이 닥터린 유산균을 선택하는 경우가 많아요. (주)팜크로스에서 만드는 이 제품은 캡슐 1개가 230mg으로, 같은 100억 CFU 함량의 다른 캡슐 제품들(450~500mg)보다 캡슐 크기가 작아요. 고함량을 유지하면서 삼키기 편한 소형 캡슐을 원한다면 선택지가 될 수 있어요.",
    productName: "닥터린 유산균 100억 60캡슐", productDesc: "프로바이오틱스 100억 CFU 230mg 소형 경질캡슐. 같은 함량 대비 작은 캡슐 사이즈.",
    externalSearchUrl: "https://search.shopping.naver.com/search/all?query=닥터린+유산균",
    ingredients: [{ type:"주성분", name:"프로바이오틱스", amount:"100억 CFU(10,000,000,000 CFU)/230mg", role:"유산균 증식·유해균 억제, 배변활동 원활, 장 건강" }],
    sections: [
      { title:"닥터린 유산균 성분은 무엇인가요?", content:"캡슐 1개(230mg)에 프로바이오틱스 100억 CFU가 담겨 있어요. 같은 100억 CFU 함량에서 뉴트리원(450mg)·듀오락(500mg)보다 캡슐 크기가 작은 편이에요. 아연·비타민D 같은 추가 성분 없이 프로바이오틱스 단일 구성이에요.\n\n제형은 흰노랑색 내용물을 담은 투명한 경질캡슐이에요. 대장균군 음성, 붕해 20분 이내 기준을 통과한 제품이에요.\n\n고함량을 원하면서 캡슐 크기 부담을 줄이고 싶은 분에게 맞는 선택이에요.", hasIngredients: true },
      { title:"닥터린 유산균 효과가 나타나려면 얼마나 걸리나요?", content:"식약처가 인정한 기능성은 세 가지예요. ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강에 도움이에요. 프로바이오틱스 단일 구성이라 면역이나 뼈 건강 기능성은 없고 장 건강에 집중된 구성이에요.\n\n배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 처음 1~2주 적응 과정으로 가스가 늘거나 장이 예민해지는 느낌이 생길 수 있어요.\n\n3개월을 효과 판단 기준으로 두고 식이섬유와 수분 섭취를 함께 챙기세요." },
      { title:"닥터린 유산균 복용법은 어떻게 되나요?", content:"1일 1회, 1회 1캡슐을 물과 함께 섭취해요. 캡슐이 230mg으로 작은 편이지만 물 한 컵은 꼭 함께 준비하세요. 식전·식후 구분 없이 섭취 가능해요.\n\n항생제 복용 중이라면 최소 2시간 이상 간격을 두거나 치료 후 섭취하세요. 더 먹는다고 효과가 좋아지지 않으니 1일 1캡슐을 지키세요.", showPriceCTA: true },
      { title:"닥터린 유산균 가격은 얼마인가요?", content:"닥터린 유산균 100억 60캡슐 기준 가격은 구매 채널마다 차이가 있어요. 아래 버튼에서 네이버 쇼핑 실시간 최저가를 직접 확인하고 비교해보세요." },
      { title:"닥터린 유산균 주의사항은 무엇인가요?", content:"질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담하세요. 알레르기 체질은 개인에 따라 과민반응이 나타날 수 있어요. 어린이가 하루 1캡슐 이상 섭취하지 않도록 지도하세요." },
      { title:"닥터린 유산균 보관할 때 주의할 점은 무엇인가요?", content:"직사광선과 고온다습한 곳을 피해 건조하고 서늘한 실온에 보관하세요. 유통기한은 제조일로부터 18개월이에요.\n\n냉장 보관은 불필요하며 오히려 결로가 생길 수 있어요." },
    ],
    faq: [
      { question:"캡슐 크기가 실제로 작은가요?", answer:"230mg 캡슐은 같은 100억 CFU 함량의 다른 제품들(450~500mg)보다 작은 편이에요. 다만 캡슐 크기는 부형제 구성에 따라서도 달라질 수 있으니 실제 제품 사진을 확인하는 게 좋아요." },
      { question:"언제부터 효과가 나타나나요?", answer:"배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 처음 1~2주는 적응 과정이에요. 3개월을 기준으로 꾸준히 챙겨보세요." },
      { question:"3개월 이상 먹었는데 효과가 없으면요?", answer:"식이섬유, 수분, 운동량을 먼저 점검하세요. 항생제 병용이나 불규칙한 섭취도 효과를 낮추는 원인이에요. 이 조건을 다 확인했는데도 변화가 없다면 균주 조합이나 함량이 다른 제품으로 바꿔보는 것도 방법이에요." },
    ],
  },
  {
    slug: "대웅프로바이오틱스",
    label: "대웅제약", badge: "100억+아연·분말포",
    h1: "대웅제약 프로바이오틱스 최저가 가격 | 성분 효과 복용법 부작용까지",
    heroDescription: "대웅제약 브랜드의 유산균을 찾는다면 100억 프로바이오틱스 생유산균 맥스가 눈에 띌 거예요. 코스맥스엔비티(주)에서 제조하는 이 제품은 1포(2000mg)에 프로바이오틱스 100억 CFU와 아연 8.5mg이 담긴 분말포예요. 종근당 락토핏 골드처럼 분말 타입이지만, 물 없이 섭취하는 락토핏 골드와 달리 물과 함께 마시는 방식이에요.",
    productName: "대웅제약 프로바이오틱스 100억 60포", productDesc: "프로바이오틱스 100억 CFU + 아연 8.5mg 복합. 물과 함께 마시는 분말포 유산균.",
    externalSearchUrl: "https://search.shopping.naver.com/search/all?query=대웅제약+프로바이오틱스",
    ingredients: [
      { type:"주성분", name:"프로바이오틱스", amount:"100억 CFU(10,000,000,000 CFU)/2000mg", role:"유산균 증식·유해균 억제, 배변활동 원활, 장 건강" },
      { type:"주성분", name:"아연", amount:"8.5mg/2000mg", role:"정상적인 면역기능·세포분열에 필요한 미네랄" },
    ],
    sections: [
      { title:"대웅제약 프로바이오틱스 성분은 무엇인가요?", content:"1포(2000mg)에 프로바이오틱스 100억 CFU와 아연 8.5mg이 담겨 있어요. 분말 제형이라 1포 중량이 2000mg으로, 캡슐형 100억 제품들(230~500mg)보다 훨씬 많은 양이에요.\n\n아연 8.5mg은 성인 하루 권장 섭취량(8.5~10mg)에 해당하는 양이에요. 락토핏 골드(아연 2.55mg)보다 아연 함량이 높아, 아연을 더 많이 챙기고 싶은 분에게 맞는 구성이에요.\n\n성상은 노랑 하양색의 입자성이 있는 분말이에요. 고유의 향미가 있고 이미·이취가 없는 것이 정품 기준이에요.", hasIngredients: true },
      { title:"대웅제약 프로바이오틱스 효과가 나타나려면 얼마나 걸리나요?", content:"식약처가 인정한 기능성은 네 가지예요. 프로바이오틱스로 ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강, 아연으로 ④ 정상적인 면역기능·세포분열에 필요해요. 락토핏 골드와 동일한 기능성 구성이지만 아연 함량이 8.5mg으로 더 높아요.\n\n배변 변화는 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 아연의 면역 효과는 꾸준한 장기 섭취를 통해 누적되는 영역이에요.\n\n분말 형태라 빠른 용출이 장점이지만, 물과 함께 섭취해야 해요. 락토핏 골드처럼 물 없이 섭취하다가 바꾸면 방식이 달라지니 처음에 주의가 필요해요." },
      { title:"대웅제약 프로바이오틱스 복용법은 어떻게 되나요?", content:"1일 1회, 1회 1포를 물과 함께 섭취해요. 분말을 물에 풀어 마시거나 입안에 털어 넣고 물로 삼켜도 돼요.\n\n개봉 후 즉시 섭취하세요. 흡습이 빠르게 일어나 방치하면 눅눅해져요. 아연을 포함한 다른 보충제와 병용 시 하루 아연 합산량을 확인하세요.", showPriceCTA: true },
      { title:"대웅제약 프로바이오틱스 가격은 얼마인가요?", content:"대웅제약 프로바이오틱스 100억 60포 기준 가격은 구매 채널마다 차이가 있어요. 아래 버튼에서 네이버 쇼핑 실시간 최저가를 직접 확인하고 비교해보세요." },
      { title:"대웅제약 프로바이오틱스 주의사항은 무엇인가요?", content:"질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담하세요. 아연을 포함한 다른 보충제와 병용 시 하루 합산 아연 섭취량이 상한(35mg)을 넘지 않는지 확인하세요.\n\n어린이가 하루 1포 이상 섭취하지 않도록 지도하세요." },
      { title:"대웅제약 프로바이오틱스 보관할 때 주의할 점은 무엇인가요?", content:"직사광선이나 고온다습한 곳을 피해 청결하고 서늘한 실온에 보관하세요. 유통기한은 제조일로부터 18개월이에요.\n\n분말 제형은 습기에 취약해요. 개봉 후에는 즉시 섭취하세요. 냉장 보관은 불필요하며 오히려 결로가 생겨 눅눅해질 수 있어요." },
    ],
    faq: [
      { question:"분말을 물에 녹여서 마셔야 하나요?", answer:"1포를 물과 함께 섭취하는 방식이에요. 물에 풀어 마셔도 되고, 입안에 털어 넣고 물로 삼켜도 돼요. 락토핏 골드처럼 물 없이 섭취하는 제품과 달리 물이 필요해요." },
      { question:"언제부터 효과가 나타나나요?", answer:"배변 변화는 2~4주 꾸준히 섭취하면서 체감해요. 아연의 면역 효과는 장기적으로 누적되는 영역이에요. 처음 1~2주는 적응 과정이에요." },
      { question:"아연을 따로 먹고 있는데 겹쳐도 되나요?", answer:"아연 하루 상한은 35mg이에요. 이 제품 1포에 아연 8.5mg이에요. 멀티비타민이나 다른 보충제에 아연이 있다면 하루 합산량을 확인하세요. 아연 과잉은 구리 흡수를 방해할 수 있어요." },
    ],
  },
];

// ── 공통 컴포넌트 ─────────────────────────────────────────────
function IngredientTable({ items }) {
  return (
    <div style={{ overflowX:"auto", borderRadius:8, border:"1px solid #e5e7eb", marginBottom:12 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:"#f9fafb" }}>
          {["구분","성분명","함량","어떤 역할?"].map(h => <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"#374151", borderBottom:"1px solid #e5e7eb" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: item.type==="주성분"?"#f0fdf4":"#fff", borderBottom: i<items.length-1?"1px solid #f3f4f6":"none" }}>
              <td style={{ padding:"9px 12px" }}><span style={{ display:"inline-flex", alignItems:"center", background: item.type==="주성분"?"#d1fae5":"#f3f4f6", color: item.type==="주성분"?"#065f46":"#6b7280", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>{item.type}</span></td>
              <td style={{ padding:"9px 12px", fontWeight:600, color:"#111827" }}>{item.name}</td>
              <td style={{ padding:"9px 12px", color:"#6b7280" }}>{item.amount}</td>
              <td style={{ padding:"9px 12px", color:"#4b5563" }}>{item.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdSlot() {
  return <div style={{ background:"#f8f8f8", border:"1px dashed #ddd", padding:"14px", textAlign:"center", fontSize:11, color:"#bbb", borderRadius:6, margin:"12px 0" }}>광고 영역</div>;
}

function ArticlePage({ article }) {
  const [openFaq, setOpenFaq] = useState(null);
  return (
    <div style={{ flex:1, maxWidth:768, minWidth:0 }}>
      {/* 제품 카드 */}
      <section style={{ padding:"20px 0 12px" }}>
        <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:"14px 16px", background:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center", minWidth:0 }}>
            <div style={{ width:56, height:56, background:"#f0fdf4", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>💊</div>
            <div style={{ minWidth:0 }}>
              <div style={{ display:"inline-flex", background:"#d1fae5", color:"#065f46", fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, marginBottom:4 }}>건강기능식품</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#111", marginBottom:2 }}>{article.productName}</div>
              <div style={{ fontSize:12, color:"#6b7280" }}>{article.productDesc}</div>
            </div>
          </div>
          <a href={article.externalSearchUrl} target="_blank" rel="noopener noreferrer" style={{ background:"#16a34a", color:"#fff", padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, textDecoration:"none", whiteSpace:"nowrap" }}>최저가 확인 →</a>
        </div>
      </section>
      <AdSlot />
      <article>
        {article.sections.map((section, i) => {
          const { Icon, color, bg } = getSectionIcon(section.title);
          return (
            <div key={i}>
              <section style={{ marginBottom:28 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ color }}><Icon /></span>
                  </div>
                  <h2 style={{ fontSize:16, fontWeight:700, color:"#111", margin:0 }}>{section.title}</h2>
                </div>
                {section.hasIngredients && <div style={{ paddingLeft:42 }}><IngredientTable items={article.ingredients} /></div>}
                <div style={{ paddingLeft:42, fontSize:14, color:"#4b5563", lineHeight:1.85, display:"flex", flexDirection:"column", gap:10 }}>
                  {section.content.split("\n\n").map((p, pi) => <p key={pi} style={{ margin:0 }}>{p}</p>)}
                </div>
                {i < article.sections.length - 1 && <hr style={{ marginTop:24, border:"none", borderTop:"1px solid #f3f4f6" }} />}
              </section>
              {section.showPriceCTA && (
                <>
                  <section style={{ marginBottom:28 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:"#ecfdf5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><span style={{ color:"#059669" }}><Icons.BadgePercent /></span></div>
                      <h2 style={{ fontSize:16, fontWeight:700, color:"#111", margin:0 }}>{article.label} 최저가 가격 비교</h2>
                    </div>
                    <div style={{ paddingLeft:42 }}>
                      <p style={{ fontSize:14, color:"#4b5563", lineHeight:1.85, marginBottom:16 }}>{article.productName} 가격은 구매 채널마다 차이가 있어요. 네이버 쇼핑 실시간 최저가를 직접 비교해보세요.</p>
                      <a href={article.externalSearchUrl} target="_blank" rel="noopener noreferrer" style={{ display:"block", background:"#16a34a", color:"#fff", textAlign:"center", padding:"16px 24px", borderRadius:12, textDecoration:"none", boxShadow:"0 4px 14px rgba(22,163,74,0.25)" }}>
                        <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize:16, fontWeight:700 }}>💊 {article.label} 최저가 확인하기</span>
                        <span style={{ display:"block", fontSize:12, color:"#bbf7d0", marginTop:4 }}>네이버 쇼핑 실시간 최저가 비교 →</span>
                      </a>
                    </div>
                    <hr style={{ marginTop:24, border:"none", borderTop:"1px solid #f3f4f6" }} />
                  </section>
                  <AdSlot />
                </>
              )}
            </div>
          );
        })}
      </article>
      {/* FAQ */}
      <section style={{ marginTop:32 }}>
        <h2 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:14 }}>자주 묻는 질문</h2>
        <div style={{ border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
          {article.faq.map((item, i) => (
            <div key={i} style={{ borderBottom: i<article.faq.length-1?"1px solid #e5e7eb":"none" }}>
              <button onClick={() => setOpenFaq(openFaq===i?null:i)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", background:"none", border:"none", cursor:"pointer", textAlign:"left", gap:8 }}>
                <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>{item.question}</span>
                <Icons.ChevronDown open={openFaq===i} />
              </button>
              {openFaq===i && <div style={{ padding:"0 20px 14px", fontSize:14, color:"#555", lineHeight:1.75 }}>{item.answer}</div>}
            </div>
          ))}
        </div>
      </section>
      <AdSlot />
      {/* 저자 */}
      <div style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fafafa", padding:18, marginTop:24, display:"flex", gap:14, alignItems:"flex-start" }}>
        <div style={{ width:44, height:44, borderRadius:"50%", background:"#d1fae5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22 }}>💊</div>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#111" }}>의약품 에디터</span>
            <span style={{ background:"#d1fae5", color:"#065f46", fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>의약품 정보 전문</span>
          </div>
          <p style={{ fontSize:13, color:"#6b7280", marginTop:6, lineHeight:1.65 }}>공공데이터 기반으로 건강기능식품 성분, 기능성, 주의사항 정보를 쉽게 풀어드려요.</p>
          <div style={{ marginTop:8, display:"flex", gap:10, alignItems:"center", fontSize:11, color:"#9ca3af" }}>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><Icons.Calendar /> 작성 2026년 4월 4일</span>
            <span style={{ display:"inline-flex", alignItems:"center", gap:3, background:"#eff6ff", color:"#2563eb", padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:600 }}><Icons.Database /> 식약처 공공데이터</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function Preview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const article = articles[activeIdx];

  return (
    <div style={{ fontFamily:"-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background:"#f5f5f5", minHeight:"100vh", color:"#1a1a1a", fontSize:15, lineHeight:1.7 }}>
      {/* 헤더 */}
      <header style={{ background:"#fff", borderBottom:"1px solid #eee", padding:"12px 24px", display:"flex", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <span style={{ fontSize:17, fontWeight:700 }}>약정보<span style={{ color:"#16a34a" }}>.jjyu</span></span>
        <nav style={{ marginLeft:"auto", fontSize:12, color:"#888", display:"flex", alignItems:"center", gap:4 }}>
          홈 <Icons.ChevronRight /> 유산균 <Icons.ChevronRight /> <span style={{ color:"#111", fontWeight:500 }}>{article.label}</span>
        </nav>
      </header>

      {/* 탭 선택기 */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"0 24px", overflowX:"auto" }}>
        <div style={{ display:"flex", gap:0, maxWidth:1024, margin:"0 auto" }}>
          {articles.map((a, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} style={{ padding:"12px 16px", fontSize:13, fontWeight: i===activeIdx?700:400, color: i===activeIdx?"#16a34a":"#6b7280", border:"none", background:"none", cursor:"pointer", borderBottom: i===activeIdx?"2px solid #16a34a":"2px solid transparent", whiteSpace:"nowrap", transition:"all 0.15s" }}>
              {a.label}
              <span style={{ marginLeft:6, fontSize:10, background: i===activeIdx?"#d1fae5":"#f3f4f6", color: i===activeIdx?"#065f46":"#9ca3af", padding:"2px 6px", borderRadius:20, fontWeight:600 }}>{a.badge}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section style={{ background:"linear-gradient(to bottom, #f0fdf4, #fff)", borderBottom:"1px solid #e5e7eb" }}>
        <div style={{ maxWidth:768, margin:"0 auto", padding:"40px 24px 28px" }}>
          <span style={{ display:"inline-flex", alignItems:"center", background:"#059669", color:"#fff", fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20, marginBottom:12 }}>💊 유산균/프로바이오틱스</span>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#111", lineHeight:1.4, marginBottom:12 }}>{article.h1}</h1>
          <p style={{ fontSize:15, color:"#555", lineHeight:1.8 }}>{article.heroDescription}</p>
          <div style={{ marginTop:10, fontSize:13, color:"#9ca3af" }}>의약품 에디터 | 2026-04-04 작성</div>
        </div>
      </section>

      {/* 2컬럼 */}
      <div style={{ maxWidth:1024, margin:"0 auto", padding:"0 16px", display:"flex", gap:32, alignItems:"flex-start" }}>
        <ArticlePage key={article.slug} article={article} />
        {/* 사이드바 */}
        <aside style={{ width:230, flexShrink:0 }}>
          <div style={{ position:"sticky", top:20 }}>
            <nav style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:12 }}>📋 유산균 비교 가이드</h3>
              <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:2 }}>
                {articles.map((a, i) => (
                  <li key={i}>
                    <button onClick={() => setActiveIdx(i)} style={{ width:"100%", display:"flex", alignItems:"center", gap:6, borderRadius:8, padding:"7px 10px", fontSize:13, cursor:"pointer", border:"none", textAlign:"left", background: i===activeIdx?"#f0fdf4":"transparent", color: i===activeIdx?"#065f46":"#6b7280", fontWeight: i===activeIdx?700:400, borderLeft: i===activeIdx?"2px solid #10b981":"2px solid transparent" }}>
                      <span style={{ color: i===activeIdx?"#10b981":"#d1d5db", flexShrink:0 }}><Icons.ChevronRight /></span>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
