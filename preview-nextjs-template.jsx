import { useState } from "react";

// ── 아이콘 SVG 인라인 ───────────────────────────────────────
const Icons = {
  ChevronRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  ),
  ChevronDown: ({ open }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
  ),
  Pill: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
  ),
  ClipboardList: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
  ),
  ShieldAlert: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
  ),
  PackageOpen: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-9"/><path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8 15 3 12.57a1.93 1.93 0 0 1 0-3.36z"/><path d="M3.58 6.98L12 2l8.42 4.98"/><path d="M21 12v5a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 17v-5"/></svg>
  ),
  BadgePercent: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="9" x2="15" y1="15" y2="9"/><circle cx="9.5" cy="9.5" r=".5" fill="currentColor"/><circle cx="14.5" cy="14.5" r=".5" fill="currentColor"/></svg>
  ),
  Calendar: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  ),
  Database: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
  ),
};

// ── 섹션 아이콘 매핑 ─────────────────────────────────────────
function getSectionIcon(title) {
  if (title.includes("성분")) return { Icon: Icons.Pill, color: "#3b82f6", bg: "#eff6ff" };
  if (title.includes("효과") || title.includes("효능")) return { Icon: Icons.Sparkles, color: "#f59e0b", bg: "#fffbeb" };
  if (title.includes("복용법") || title.includes("사용법")) return { Icon: Icons.ClipboardList, color: "#10b981", bg: "#f0fdf4" };
  if (title.includes("가격") || title.includes("최저가")) return { Icon: Icons.BadgePercent, color: "#059669", bg: "#ecfdf5" };
  if (title.includes("주의사항")) return { Icon: Icons.ShieldAlert, color: "#f97316", bg: "#fff7ed" };
  if (title.includes("보관")) return { Icon: Icons.PackageOpen, color: "#8b5cf6", bg: "#f5f3ff" };
  return { Icon: Icons.ClipboardList, color: "#9ca3af", bg: "#f9fafb" };
}

// ── 데이터 ───────────────────────────────────────────────────
const article = {
  h1: "종근당 락토핏 골드 최저가 가격 | 성분 효과 복용법 부작용까지",
  heroDescription: "유산균을 고를 때 CFU 수만 보다가 아연까지 한 번에 챙기는 제품을 찾게 되면 락토핏 골드가 후보에 오를 거예요. 종근당건강(주)에서 만든 이 제품은 1포(2g)에 프로바이오틱스 40억 CFU와 아연 2.55mg이 들어있어요. 식전·식후 구분 없이 물 없이 바로 섭취할 수 있어서 바쁜 일상에서도 빠뜨리지 않기 쉬운 분말형 유산균이에요.",
  datePublished: "2026-04-04",
  faq: [
    { question: "락토핏 골드 공복에 먹어도 되나요?", answer: "식전·식후 어느 때나 섭취 가능해요. 식약처 인정 건강기능식품은 위산 저항성을 고려한 기준을 통과한 제품이에요. 섭취 타이밍보다 매일 빠뜨리지 않는 게 훨씬 중요해요. 가장 규칙적으로 지킬 수 있는 시간을 하나 정해두고 1포씩 챙기세요." },
    { question: "락토핏 골드는 언제부터 효과가 나타나나요?", answer: "배변활동 변화는 빠르면 2주, 대부분 1개월 이상 꾸준히 섭취해야 느껴지기 시작해요. 처음 1~2주는 가스가 늘거나 장이 예민해지는 느낌이 생길 수 있는데, 유산균이 장내에 자리잡는 적응 과정이에요. 이 시기에 중단하면 효과를 제대로 판단할 수 없어요." },
    { question: "3개월 먹어도 효과가 없으면 어떻게 해야 하나요?", answer: "먼저 식이섬유 섭취량, 수분, 운동량을 점검해보세요. 유산균은 프리바이오틱스(식이섬유)를 먹어야 잘 증식해요. 항생제를 병용했거나 섭취가 불규칙했다면 효과가 낮을 수밖에 없어요. 꾸준히 챙겼는데도 변화가 없다면 다른 균주 조합이나 CFU 함량 제품으로 바꾸는 것도 방법이에요." },
  ],
  sections: [
    {
      title: "락토핏 골드 성분은 무엇인가요?",
      content: "1포(2g)에 프로바이오틱스 40억 CFU와 아연 2.55mg이 함께 담겨 있어요. 식약처 프로바이오틱스 함량 기준(1억~1,000억 CFU) 안에서 40억은 중간 함량이에요. 너무 낮으면 효과가 약하고, 너무 높으면 처음 섭취 시 가스·복부 팽만이 생길 수 있어서 40억은 유산균을 처음 시작하거나 꾸준히 유지하려는 분에게 부담 없는 함량이에요.\n\n아연 2.55mg은 식약처 하루 권장 섭취량(성인 기준 8.5~10mg)의 약 25~30%예요. 아연은 면역 기능과 정상적인 세포 분열에 필요한 미네랄이에요. 단순 유산균 제품과 달리 락토핏 골드는 장 건강과 면역 케어를 1포로 함께 챙길 수 있다는 게 차별점이에요.\n\n제형은 흰보라색 분말이에요. 고유의 향미가 있고 이미·이취가 없는 것이 정품 기준이에요. 대장균군 검사 음성을 통과한 제품이에요.",
      ingredients: [
        { type: "주성분", name: "프로바이오틱스", amount: "40억 CFU/2g", role: "유산균 증식·유해균 억제, 배변활동 원활, 장 건강" },
        { type: "주성분", name: "아연", amount: "2.55mg/2g", role: "정상적인 면역기능·세포분열에 필요한 미네랄" },
      ],
    },
    {
      title: "락토핏 골드 효과가 나타나려면 얼마나 걸리나요?",
      content: "식약처가 인정한 기능성은 네 가지예요. 프로바이오틱스로는 ① 유산균 증식 및 유해균 억제, ② 배변활동 원활, ③ 장 건강에 도움이 돼요. 아연은 ④ 정상적인 면역기능과 세포분열에 필요해요. 장 관련 3가지와 면역 관련 1가지가 1포에 들어있는 셈이에요.\n\n배변 변화는 보통 2~4주 꾸준히 섭취하면서 체감하기 시작해요. 장내 균총이 새로운 유산균에 맞게 조정되는 데 시간이 걸리기 때문이에요. 처음 1~2주는 가스가 늘거나 장이 더 예민해지는 느낌이 생길 수 있는데, 이건 유산균이 자리잡는 적응 과정이에요.\n\n3개월을 효과 판단 기준으로 삼는 게 좋아요. 1개월이면 장 환경 변화 여부를, 3개월이면 면역·장 건강 전반의 개선 여부를 확인할 수 있어요. 3개월 이후에도 변화가 없다면 식이섬유 섭취량과 수분 섭취를 먼저 점검해보세요.",
    },
    {
      title: "락토핏 골드 복용법은 어떻게 되나요?",
      content: "1일 1회, 1회 1포(2g)를 식전·식후 어느 때나 물 없이 섭취해요. 분말을 입안에 그대로 녹여 먹는 방식이에요. 물과 함께 섭취해도 되고, 물이 없는 상황에서도 먹을 수 있어서 편리해요.\n\n매일 같은 시간에 1포씩 꾸준히 챙기는 것이 섭취 타이밍보다 훨씬 중요해요. 아침 식후든 잠들기 전이든, 가장 빠뜨리지 않을 시간을 고정해두는 게 실질적인 방법이에요. 더 먹는다고 효과가 더 좋아지지 않으니 1일 1포를 지키세요.\n\n항생제를 복용 중이라면 최소 2시간 간격을 두거나 항생제 치료가 끝난 뒤 섭취하는 걸 권장해요. 항생제는 유익균과 유해균을 구별하지 않고 죽이기 때문에, 동시에 먹으면 유산균의 효과를 기대하기 어려워요. 포는 개봉 후 즉시 섭취하세요.",
      showPriceCTA: true,
    },
    {
      title: "락토핏 골드 주의사항은 무엇인가요?",
      content: "질환이 있거나 의약품을 복용 중이라면 섭취 전 전문가와 상담하세요. 특히 항생제·면역억제제를 복용 중이라면 의사에게 확인하는 게 안전해요. 임산부·수유부도 섭취 전 전문가와 상담이 필요해요.\n\n알레르기 체질은 개인에 따라 과민반응이 나타날 수 있어요. 첫 섭취 후 두드러기, 가려움, 호흡 불편 같은 증상이 생기면 즉시 섭취를 중단하고 전문가와 상담하세요. 이상사례가 발생하면 섭취를 중단하고 전문가에게 확인하는 것이 원칙이에요.\n\n어린이가 하루 1포 이상 섭취하지 않도록 지도하세요. 소비기한이 지난 제품은 섭취하지 마세요. 개봉 후에는 흡습 우려가 있으므로 바로 섭취하세요.",
    },
    {
      title: "락토핏 골드 보관할 때 주의할 점은 무엇인가요?",
      content: "어린이의 손이 닿지 않고, 직사광선을 피해 서늘한 곳에 보관해요. 유통기한은 제조일부터 18개월이에요.\n\n분말 제형은 습기에 취약해요. 냉장 보관은 불필요하고, 냉장고에서 꺼낼 때 결로가 생겨 오히려 눅눅해질 수 있어요. 실온의 서늘하고 건조한 곳이 최적이에요. 욕실 선반처럼 습기가 자주 차는 곳은 피하세요.\n\n개별 포 단위로 포장되어 있어서 개봉하지 않은 포는 유통기한 내내 안전해요. 여행이나 출장 때는 필요한 수량만 개별 포로 꺼내 가져가면 편리해요.",
    },
  ],
};

const sidebarSpokes = [
  { slug: "종근당락토핏골드", active: true },
  { slug: "종근당락토핏생유산균" },
  { slug: "듀오락유산균" },
  { slug: "뉴트리원프로바이오틱스" },
  { slug: "GNM유산균" },
  { slug: "프롬바이오유산균" },
  { slug: "대웅프로바이오틱스" },
  { slug: "비피도프로바이오틱스" },
  { slug: "닥터린유산균" },
];

const relatedSpokes = [
  { slug: "종근당락토핏생유산균", desc: "생유산균 10억 CFU 분말포 코어 라인" },
  { slug: "듀오락유산균", desc: "쎌바이오텍 100억 CFU 캡슐형 프로바이오틱스" },
  { slug: "뉴트리원프로바이오틱스", desc: "100억 CFU 캡슐형 뉴트리원 장 건강 유산균" },
];

// ── 컴포넌트 ─────────────────────────────────────────────────

function Badge({ children }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", background:"#059669", color:"#fff", fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:20, marginBottom:12 }}>
      {children}
    </span>
  );
}

function IngredientTable({ items }) {
  return (
    <div style={{ overflowX:"auto", borderRadius:8, border:"1px solid #e5e7eb", marginBottom:12 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f9fafb" }}>
            {["구분","성분명","함량","어떤 역할?"].map(h => (
              <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"#374151", borderBottom:"1px solid #e5e7eb" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: item.type==="주성분" ? "#f0fdf4" : "#fff", borderBottom: i<items.length-1?"1px solid #f3f4f6":"none" }}>
              <td style={{ padding:"9px 12px" }}>
                <span style={{ display:"inline-flex", alignItems:"center", background: item.type==="주성분"?"#d1fae5":"#f3f4f6", color: item.type==="주성분"?"#065f46":"#6b7280", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>
                  {item.type}
                </span>
              </td>
              <td style={{ padding:"9px 12px", fontWeight: item.type==="주성분"?600:400, color:"#111827" }}>{item.name}</td>
              <td style={{ padding:"9px 12px", color:"#6b7280" }}>{item.amount||"-"}</td>
              <td style={{ padding:"9px 12px", color:"#4b5563" }}>{item.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriceCTA() {
  return (
    <a href="#" style={{ display:"block", background:"#16a34a", color:"#fff", textAlign:"center", padding:"16px 24px", borderRadius:12, textDecoration:"none", boxShadow:"0 4px 14px rgba(22,163,74,0.25)", marginTop:4 }}>
      <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontSize:16, fontWeight:700 }}>
        💊 종근당락토핏골드 최저가 확인하기
      </span>
      <span style={{ display:"block", fontSize:12, color:"#bbf7d0", marginTop:4 }}>
        약국별 실시간 가격 비교 →
      </span>
    </a>
  );
}

function AdSlot() {
  return (
    <div style={{ background:"#f8f8f8", border:"1px dashed #ddd", padding:"14px", textAlign:"center", fontSize:11, color:"#bbb", borderRadius:6, margin:"12px 0" }}>
      광고 영역
    </div>
  );
}

function FAQSection({ items }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <section style={{ marginTop:32 }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:14 }}>자주 묻는 질문</h2>
      <div style={{ border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
        {items.map((item, i) => (
          <div key={i} style={{ borderBottom: i<items.length-1?"1px solid #e5e7eb":"none" }}>
            <button
              onClick={() => setOpenIdx(openIdx===i?null:i)}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", background:"none", border:"none", cursor:"pointer", textAlign:"left", gap:8 }}
            >
              <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>{item.question}</span>
              <Icons.ChevronDown open={openIdx===i} />
            </button>
            {openIdx===i && (
              <div style={{ padding:"0 20px 14px", fontSize:14, color:"#555", lineHeight:1.75 }}>
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AuthorBio() {
  return (
    <div style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fafafa", padding:18, marginTop:24, display:"flex", gap:14, alignItems:"flex-start" }}>
      <div style={{ width:44, height:44, borderRadius:"50%", background:"#d1fae5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22 }}>💊</div>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#111" }}>의약품 에디터</span>
          <span style={{ background:"#d1fae5", color:"#065f46", fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>의약품 정보 전문</span>
          <span style={{ border:"1px solid #e5e7eb", background:"#fff", fontSize:10, color:"#6b7280", padding:"2px 8px", borderRadius:20 }}>유산균</span>
        </div>
        <p style={{ fontSize:13, color:"#6b7280", marginTop:6, lineHeight:1.65 }}>공공데이터 기반으로 건강기능식품 성분, 기능성, 주의사항 정보를 쉽게 풀어드려요. 정확한 정보 전달을 위해 식약처 공식 데이터를 활용합니다.</p>
        <div style={{ marginTop:8, display:"flex", gap:10, alignItems:"center", fontSize:11, color:"#9ca3af" }}>
          <span style={{ display:"flex", alignItems:"center", gap:3 }}><Icons.Calendar /> 작성 2026년 4월 4일</span>
          <span style={{ display:"inline-flex", alignItems:"center", gap:3, background:"#eff6ff", color:"#2563eb", padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:600 }}><Icons.Database /> 식약처 공공데이터</span>
        </div>
      </div>
    </div>
  );
}

function RelatedSpokesComp() {
  return (
    <section style={{ marginBottom:24 }}>
      <div style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fafafa", padding:18 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:12 }}>📋 다른 유산균도 비교해 보세요</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {relatedSpokes.map(s => (
            <a key={s.slug} href="#" style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#fff", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", textDecoration:"none" }}>
              <span style={{ color:"#10b981", flexShrink:0, marginTop:2 }}><Icons.ChevronRight /></span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{s.slug} 성분 효과 부작용까지</div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{s.desc}</div>
              </div>
            </a>
          ))}
          <a href="#" style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", textDecoration:"none" }}>
            <span style={{ color:"#9ca3af", flexShrink:0 }}><Icons.ChevronRight /></span>
            <span style={{ fontSize:13, color:"#6b7280" }}>유산균 199개 더 비교하기</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Sidebar() {
  return (
    <aside style={{ width:230, flexShrink:0 }}>
      <div style={{ position:"sticky", top:20 }}>
        <nav style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", padding:16 }}>
          <h3 style={{ fontSize:13, fontWeight:700, color:"#111", marginBottom:12 }}>📋 유산균 비교 가이드</h3>
          <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:2 }}>
            {sidebarSpokes.map(s => (
              <li key={s.slug}>
                <a href="#" style={{
                  display:"flex", alignItems:"center", gap:6, borderRadius:8, padding:"7px 10px", fontSize:13, textDecoration:"none",
                  background: s.active?"#f0fdf4":"transparent",
                  color: s.active?"#065f46":"#6b7280",
                  fontWeight: s.active?700:400,
                  borderLeft: s.active?"2px solid #10b981":"2px solid transparent",
                }}>
                  <span style={{ color: s.active?"#10b981":"#d1d5db", flexShrink:0 }}><Icons.ChevronRight /></span>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.slug}</span>
                </a>
              </li>
            ))}
          </ul>
          <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            <a href="#" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", fontSize:12, color:"#6b7280", textDecoration:"none" }}>
              <Icons.ChevronRight /> 유산균 가이드 전체 보기
            </a>
            <a href="#" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", fontSize:12, color:"#059669", fontWeight:600, textDecoration:"none" }}>
              <Icons.ChevronRight /> 💰 가격비교 보기
            </a>
          </div>
        </nav>
      </div>
    </aside>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function PharmPage() {
  return (
    <div style={{ fontFamily:"-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background:"#f5f5f5", minHeight:"100vh", color:"#1a1a1a", fontSize:15, lineHeight:1.7 }}>

      {/* 헤더 */}
      <header style={{ background:"#fff", borderBottom:"1px solid #eee", padding:"12px 24px", display:"flex", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <span style={{ fontSize:17, fontWeight:700 }}>약정보<span style={{ color:"#16a34a" }}>.jjyu</span></span>
        <nav style={{ marginLeft:"auto", fontSize:12, color:"#888", display:"flex", alignItems:"center", gap:4 }}>
          홈 <Icons.ChevronRight /> 유산균 <Icons.ChevronRight /> <span style={{ color:"#111", fontWeight:500 }}>종근당락토핏골드</span>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ background:"linear-gradient(to bottom, #f0fdf4, #fff)", borderBottom:"1px solid #e5e7eb" }}>
        <div style={{ maxWidth:768, margin:"0 auto", padding:"40px 24px 28px" }}>
          <Badge>💊 유산균/프로바이오틱스</Badge>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#111", lineHeight:1.4, marginBottom:12 }}>{article.h1}</h1>
          <p style={{ fontSize:15, color:"#555", lineHeight:1.8 }}>{article.heroDescription}</p>
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#9ca3af", flexWrap:"wrap" }}>
            <a href="#" style={{ color:"#555", fontWeight:500, textDecoration:"none" }}>의약품 에디터</a>
            <span>|</span>
            <time style={{}}>{article.datePublished} 작성</time>
          </div>
          {/* 공유 버튼 placeholder */}
          <div style={{ marginTop:12, display:"flex", gap:8 }}>
            {["공유","댓글","K","f","T"].map(b => (
              <button key={b} style={{ width:30, height:30, borderRadius:"50%", border:"1px solid #e5e7eb", background:"#fff", fontSize:11, color:"#777", cursor:"pointer" }}>{b}</button>
            ))}
          </div>
        </div>
      </section>

      {/* 2컬럼 레이아웃 */}
      <div style={{ maxWidth:1024, margin:"0 auto", padding:"0 16px", display:"flex", gap:32, alignItems:"flex-start" }}>

        {/* 메인 컬럼 */}
        <div style={{ flex:1, maxWidth:768, minWidth:0 }}>

          {/* 제품 카드 */}
          <section style={{ padding:"20px 0 12px" }}>
            <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:"14px 16px", background:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
              <div style={{ display:"flex", gap:14, alignItems:"center", minWidth:0 }}>
                <div style={{ width:56, height:56, background:"#f0fdf4", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>💊</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"inline-flex", background:"#d1fae5", color:"#065f46", fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, marginBottom:4 }}>건강기능식품</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#111", marginBottom:2 }}>종근당 락토핏 골드 60포</div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>프로바이오틱스 40억 CFU + 아연 복합. 장 건강·면역 기능을 동시에 챙기는 종근당 대표 유산균.</div>
                </div>
              </div>
              <a href="#" style={{ background:"#16a34a", color:"#fff", padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, textDecoration:"none", whiteSpace:"nowrap" }}>최저가 확인 →</a>
            </div>
          </section>

          <AdSlot />

          {/* 섹션들 */}
          <article>
            {article.sections.map((section, i) => {
              const { Icon, color, bg } = getSectionIcon(section.title);
              return (
                <div key={i}>
                  <section style={{ marginBottom:28 }}>
                    {/* 섹션 헤더 */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ color }}><Icon /></span>
                      </div>
                      <h2 style={{ fontSize:16, fontWeight:700, color:"#111", margin:0 }}>{section.title}</h2>
                    </div>

                    {/* 성분 테이블 */}
                    {section.ingredients && (
                      <div style={{ paddingLeft:42 }}>
                        <IngredientTable items={section.ingredients} />
                      </div>
                    )}

                    {/* 본문 */}
                    <div style={{ paddingLeft:42, fontSize:14, color:"#4b5563", lineHeight:1.85, display:"flex", flexDirection:"column", gap:10 }}>
                      {section.content.split("\n\n").map((p, pi) => <p key={pi} style={{ margin:0 }}>{p}</p>)}
                    </div>

                    {i < article.sections.length - 1 && (
                      <hr style={{ marginTop:24, border:"none", borderTop:"1px solid #f3f4f6" }} />
                    )}
                  </section>

                  {/* 복용법 직후: PriceCTA + RelatedSpokes */}
                  {section.showPriceCTA && (
                    <>
                      <section style={{ marginBottom:28 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:"#ecfdf5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ color:"#059669" }}><Icons.BadgePercent /></span>
                          </div>
                          <h2 style={{ fontSize:16, fontWeight:700, color:"#111", margin:0 }}>종근당락토핏골드 최저가 가격 비교</h2>
                        </div>
                        <div style={{ paddingLeft:42 }}>
                          <p style={{ fontSize:14, color:"#4b5563", lineHeight:1.85, marginBottom:16 }}>
                            종근당락토핏골드의 60포 기준 가격은 구매 채널마다 차이가 있어요. 약국별 실시간 최저가를 직접 비교해보세요.
                          </p>
                          <PriceCTA />
                        </div>
                        <hr style={{ marginTop:24, border:"none", borderTop:"1px solid #f3f4f6" }} />
                      </section>

                      <AdSlot />
                      <RelatedSpokesComp />
                    </>
                  )}
                </div>
              );
            })}
          </article>

          {/* FAQ */}
          <FAQSection items={article.faq} />

          <AdSlot />

          {/* 작성자 */}
          <AuthorBio />

          {/* 뒤로가기 */}
          <div style={{ padding:"24px 0", display:"flex", gap:16 }}>
            <a href="#" style={{ fontSize:13, color:"#6b7280", textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
              ← 유산균 가이드로 돌아가기
            </a>
          </div>
        </div>

        {/* 사이드바 (데스크톱) */}
        <Sidebar />
      </div>
    </div>
  );
}
