# pharm.jjyu.co.kr 프로젝트 규칙서

> 이 파일은 Agent Teams 팀원이 동일한 품질의 글을 작성하기 위한 필수 규칙서입니다.
> 모든 에이전트는 이 규칙을 반드시 따라야 합니다.

## 프로젝트 개요

- **사이트**: pharm.jjyu.co.kr (일반의약품 정보 사이트)
- **스택**: Next.js 16.1.6 + Tailwind CSS v4 + shadcn/ui
- **배포**: Vercel (main 브랜치 자동 배포)
- **아키텍처**: Hub/Spoke (허브 = 카테고리 가이드, 스포크 = 개별 의약품 글)

## 카테고리 (8개)

| slug | 이름 | 아이콘 |
|------|------|--------|
| 탈모 | 탈모약 | 💊 |
| 연고 | 연고 | 🩹 |
| 감기 | 감기약 | 🤧 |
| 진통제 | 진통제 | 💉 |
| 무좀 | 무좀약 | 🦶 |
| 설사 | 설사약 | 💧 |
| 소화제 | 소화제 | 🫗 |
| 안약 | 안약 | 👁️ |

---

## 글쓰기 규칙

### 1. 타이틀 공식

```
{의약품명} 최저가 가격 | 성분 효과 {사용법/복용법} 부작용까지
```

- 연고류 → "사용법"
- 복용하는 약 → "복용법"
- 발키리 딥링크가 없는 제품 → "최저가 가격" 대신 "성분 효과" 사용
  - 예: `콘택600 성분 효과 | 코감기약 복용법 부작용 총정리`
- **title과 h1은 반드시 동일**

### 2. 문체: 구어체

- "~해요", "~이에요", "~예요" 사용 (존댓말)
- "~합니다", "~입니다" 사용 금지 (문어체 금지)
- metaDescription만 예외적으로 문어체 허용 ("~했습니다")
- 자연스럽고 친근한 톤 유지

### 3. 작성자

- 이름: **"의약품 에디터"** (모든 카테고리 동일)
- 프로필 링크: `/about`

### 4. 날짜

- `datePublished`: 글 최초 작성일 (YYYY-MM-DD)
- `dateModified`: 글 수정일 (YYYY-MM-DD)
- 신규 작성 시 둘 다 오늘 날짜

---

## 글 구조 (Spoke Article)

### 필수 구성 요소

1. **products**: `[]` (빈 배열 — 본문에서 제품 카드를 직접 표시하지 않음)
2. **faq**: 3개 (정확히 3개)
3. **sections**: 6개 (아래 순서 준수)

### 6개 섹션 순서

| 순서 | 제목 형식 | 필수 요소 |
|------|----------|----------|
| 1 | `{의약품명} 성분 분석` | ✅ `ingredients` 배열 필수 |
| 2 | `{의약품명} 효능과 효과` | - |
| 3 | `{의약품명} 올바른 {사용법/복용법}` | - |
| 4 | `{의약품명} 부작용` | - |
| 5 | `{의약품명} 주의사항` | - |
| 6 | `{의약품명} 보관법` | - |

### 성분 테이블 (ingredients)

첫 번째 섹션(성분 분석)에만 포함. 형식:

```typescript
ingredients: [
  { type: "주성분", name: "성분명", amount: "용량", role: "역할" },
  { type: "첨가제", name: "성분명", role: "역할" },
]
```

- `type`: "주성분" 또는 "첨가제"
- `amount`: 주성분에는 필수 (예: "10mg/g", "500mg")
- `role`: 한글로 간결하게 (예: "해열·진통", "상처 치유 촉진")

### 섹션 본문 규칙

- 각 섹션 최소 3문단 (문단 구분: `\n\n`)
- 각 문단 최소 2~3문장
- 전문 용어 사용 후 괄호로 설명 (예: "아시아티코사이드(Asiaticoside)")
- 다른 의약품과의 비교 포함 권장

### FAQ 규칙

- 정확히 3개
- 실제 사용자가 궁금해할 질문
- 답변은 구어체, 2~4문장

---

## 데이터 파일 작성 규칙

### products 데이터 (`data/products/` 또는 `data/products.ts`)

```typescript
{
  id: "제품id-규격",           // 예: "madecassol-10g"
  name: "제품 정식명칭",       // 예: "마데카솔 연고 10g"
  image: "/images/제품id.svg", // SVG placeholder
  category: "일반의약품",       // 고정값
  categorySlug: "연고",        // 카테고리 slug
  description: "한줄 설명. 2~3문장.",
  price: 3200,                 // 약국 기준 가격 (원)
  unit: "10g",                 // 규격
  barkiryQuery: "마데카솔",     // 발키리 검색어 (없으면 생략)
  barkiryProductId: "p104",    // 발키리 제품 ID (없으면 생략)
  ingredients: "주성분1,주성분2", // 쉼표 구분
  usage: "1일 1~2회 환부에 얇게 바른다",
  slug: "마데카솔",             // URL slug = 한글 의약품명
}
```

**발키리 딥링크 규칙:**
- `barkiryProductId`가 있으면 → `barkiri.com/products/{id}` 직접 링크
- `externalSearchUrl`이 있으면 → 해당 URL로 이동
- `barkiryQuery`만 있으면 → `barkiri.com/search?query={query}` 검색
- **셋 다 없으면** → CTA 버튼 자동 숨김 (ProductCard, PriceCTA)

### articles 데이터 (`data/articles/` 또는 `data/articles.ts`)

**Hub Article (허브 글):**
```typescript
{
  categorySlug: "감기",
  datePublished: "2026-01-15",
  dateModified: "2026-02-23",
  title: "감기약 추천 최저가 가격 비교 | 성분 효과 부작용 가이드",
  h1: "감기약 추천 가이드 - 증상별 감기약 선택법",
  metaDescription: "...",
  description: "...",
  heroDescription: "...",
  spokes: [
    { slug: "판콜에이", title: "판콜에이 최저가 가격 | ...", description: "..." },
    // ...
  ],
}
```

**Spoke Article (스포크 글):**
```typescript
{
  slug: "판콜에이",
  categorySlug: "감기",
  datePublished: "2026-02-23",
  dateModified: "2026-02-23",
  title: "판콜에이 최저가 가격 | 성분 효과 복용법 부작용까지",
  h1: "판콜에이 최저가 가격 | 성분 효과 복용법 부작용까지",  // title과 동일
  metaDescription: "판콜에이 종합감기약 성분과 효능, 부작용, 올바른 복용법을 정리했습니다. ...",
  description: "판콜에이 종합감기약의 효능, 성분, 복용법, 최저가 비교 정보를 제공해요.",
  heroDescription: "판콜에이는 ... (2~3문장 소개)",
  products: [],  // 빈 배열
  faq: [ /* 3개 */ ],
  sections: [ /* 6개 */ ],
}
```

---

## 발키리 딥링크 확인 절차

### 1. 제품 ID 찾기

```bash
# 발키리에서 제품 검색
curl "https://barkiri.com/search?query=판콜에이"
```

또는 `scripts/barkiri-products.json`에서 검색 (이미 크롤링된 데이터).

### 2. 딥링크 유효성 확인

```bash
# 200 응답인지 확인
curl -I "https://barkiri.com/products/p13"
```

### 3. 딥링크가 없는 경우

- `barkiryProductId` 생략
- `barkiryQuery` 생략
- → CTA 버튼 자동으로 안 나옴
- 타이틀에서 "최저가 가격" 제거

---

## UI 컴포넌트 규칙

### 사이드바 (CategorySidebar)
- PC에서만 표시 (`hidden lg:block`)
- 같은 카테고리 전체 spoke 목록 (개수 제한 없음)
- `sticky top-24`

### 본문 내부링크 (RelatedSpokes)
- **최대 3개**만 표시
- 사용법/복용법 섹션 뒤에 배치

### 하단 관련 제품 (ProductCard)
- **최대 3개**만 표시
- CTA 바 없는 제품은 자동으로 링크 비활성화

### PriceCTA (최저가 버튼)
- 사용법/복용법 섹션 뒤에 배치
- 딥링크 없는 제품은 자동 숨김 (`return null`)

---

## 빌드 & 검증 체크리스트

글 작성 완료 후 반드시 아래 순서로 검증:

### 필수 검증 (자동)
```bash
npm run build          # 빌드 성공 + 딥링크 자동 검증
```

### 수동 검증 항목
- [ ] title과 h1이 동일한가
- [ ] 구어체 ("~해요") 사용했는가
- [ ] 섹션 6개, FAQ 3개인가
- [ ] 첫 번째 섹션에 ingredients 배열이 있는가
- [ ] 성분명·용량이 정확한가 (의약품안전나라 기준)
- [ ] barkiryProductId가 200 응답인가
- [ ] hub spokes에 새 글이 추가되었는가
- [ ] products에 새 제품이 추가되었는가

---

## Agent Teams 작업 규칙

### 파일 충돌 방지
- **1 에이전트 = 1 카테고리** (절대 규칙)
- 다른 에이전트의 카테고리 파일을 수정하지 않는다
- 공통 파일 (`lib/types.ts`, `components/`, `app/`) 수정 금지

### 작업 순서
1. 발키리에서 해당 카테고리 제품 목록 확인
2. 딥링크 유효한 제품 10개 선정
3. products 데이터 추가
4. hub spokes 엔트리 추가
5. spoke 글 10개 작성 (위 규칙 준수)
6. `npm run build` 통과 확인

### 커밋 규칙
- 커밋 메시지: `{카테고리} 카테고리 {N}개 spoke 글 + 제품 추가`
- 작업 완료 후 팀 리드에게 알리기

---

## Windows 환경 주의사항

- Turbopack dev 서버가 Windows에서 자주 충돌 → `npm run build`로 검증
- `.next` 캐시 삭제 시 프로세스 잠금 문제 발생 가능
- preview_start 대신 빌드 검증 후 Vercel 배포로 확인

---

## 파일 구조

```
pharm-jjyu/
├── app/
│   ├── [category]/[slug]/page.tsx  ← Spoke 페이지 (핵심)
│   ├── [category]/page.tsx         ← Hub 페이지
│   └── about/page.tsx              ← 작성자 소개
├── components/
│   ├── AuthorBio.tsx               ← 작성자 카드
│   ├── CategorySidebar.tsx         ← PC 사이드바
│   ├── FAQSection.tsx              ← FAQ 아코디언
│   ├── IngredientTable.tsx         ← 성분 테이블
│   ├── PriceCTA.tsx                ← 최저가 버튼
│   ├── ProductCard.tsx             ← 제품 카드
│   ├── RelatedSpokes.tsx           ← 본문 내부링크 (3개 제한)
│   └── ShareButtons.tsx            ← 공유 버튼
├── data/
│   ├── articles.ts                 ← Hub + Spoke 글 데이터
│   ├── categories.ts               ← 8개 카테고리
│   └── products.ts                 ← 제품 데이터
├── lib/
│   └── types.ts                    ← TypeScript 인터페이스
└── scripts/
    ├── verify-deeplinks.js         ← 딥링크 자동 검증
    └── verify-wiki-quality.js      ← 품질 검증
```
