# pharm.jjyu.co.kr 프로젝트 규칙서

> 이 파일은 Claude Code가 `data/articles/*.ts` 파일을 작성·수정할 때 따르는 절대 규칙서다.
> `quality-config.json`, `verify-*.js` 스크립트와 연동되어 자동 검증된다.

---

## ★ Step 0: 필수 사고 (글 작성 전 생략 금지)

`data/articles/*.ts` 파일을 작성하거나 수정할 때 반드시 아래 순서를 따른다.

아래 4개 질문에 먼저 답하고, 그 답을 기반으로 글을 쓴다.

**Q1.** 이 약을 검색하는 사람은 지금 어떤 상황인가?
**Q2.** 이 사람이 이 글을 읽고 나서 해야 하는 행동은?
**Q2-1.** 이 행동을 완료하려면 독자가 마지막으로 클릭해야 하는 곳은?
　　→ barkiry 딥링크가 있으면 PriceCTA, 없으면 카테고리 내부링크
**Q3.** 이 행동을 하려면 반드시 알아야 하는 정보는?
　　(예외·주의·실제 부딪히는 상황 3가지 이상 포함)
**Q4.** 이 정보를 가장 잘 전달하는 형태는?
　　(비교표, 경고박스, 용량 그리드, 텍스트 등)

Q 답은 각각 구체적인 한 문장. "궁금해서", "알고 싶어서" 금지.

### Q→섹션 연결

| Q 답 | 글에 반영하는 방식 |
|------|--------------------|
| Q1 | heroDescription 첫 문장 (독자 상황 공감) |
| Q2 | 어느 섹션을 가장 두껍게 쓸지 결정 (순서 변경 금지) |
| Q3 | 각 섹션 내 예외·주의사항 깊이 |
| Q4 | 각 섹션 전달 방식 (표, 텍스트, 경고박스) |

### Q2 선택지 (의약품 전용)

- **"사서 바른다/먹는다"** → 사용법/복용법 섹션 가장 두껍게
- **"부작용 판단한다"** → 부작용 섹션 가장 두껍게
- **"다른 약이랑 비교해서 고른다"** → 성분 섹션에 비교 내용 추가
- **"쓰면 안 되는지 확인한다"** → 주의사항 섹션 가장 두껍게
- **"가격 확인하고 산다"** → 가격 섹션 강조, PriceCTA 위치 최우선

---

## 글 작성 절차

### Step 1: 소스 확보 (생략 금지)

1. `source-data/{slug}.json` 파일 존재 확인
2. Read로 읽기
3. **없으면** → "소스 없음. `node scripts/fetch-source.js --slug {slug}` 실행 필요" 보고 후 **중단**
4. `source-data/schema.json` 필수 필드 확인 → 불량이면 **중단**

> ⚠️ AI 학습 데이터나 웹 검색 결과로 효능·용법·부작용·주의사항·보관법을 작성하면 절대 안 된다.
> 소스 JSON 데이터만 사용한다.

### 소스 JSON 필드 → 섹션 매핑

| 소스 필드 | 섹션 |
|-----------|------|
| itemName 괄호 안 성분 | 1번: 성분 분석 |
| efcyQesitm | 2번: 효능과 효과 |
| useMethodQesitm | 3번: 사용법/복용법 |
| (barkiry 딥링크 있을 때만) | 4번: 가격 비교 |
| seQesitm | 5번: 부작용 |
| atpnQesitm | 6번: 주의사항 |
| depositMethodQesitm | 7번: 보관법 |

### Step 2: 글 작성

섹션 순서 고정. Q2 답이 강조점만 결정하고 순서는 바꾸지 않는다.

### Step 3: 검증 (작성 후 반드시 실행)

```bash
node scripts/verify-facts.js --slug {slug}     # 숫자·성분 ↔ 소스 대조
node scripts/verify-style.js --slug {slug}     # 문체·AI냄새·금지어
node scripts/verify-selfcheck.js --slug {slug} # 팩트 역추출 재대조
```

모두 PASS 후 커밋.

---

## 프로젝트 개요

- **사이트**: pharm.jjyu.co.kr (일반의약품 정보)
- **스택**: Next.js + Tailwind CSS v4 + shadcn/ui
- **배포**: Cloudflare Pages (main 브랜치 자동 배포)
- **아키텍처**: Hub/Spoke (허브 = 카테고리 가이드, 스포크 = 개별 의약품 글)

---

## 카테고리 (18개 전체)

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
| 구강 | 구강/잇몸 | 🦷 |
| 파스 | 파스/진통겔 | 🩹 |
| 영양제 | 비타민/영양제 | 🌿 |
| 여성건강 | 여성건강/생리통 | 🌸 |
| 외상소독 | 외상소독 | 🩺 |
| 두드러기 | 두드러기/피부로션 | 🧴 |
| 구충제 | 구충제 | 🪱 |
| 변비 | 변비약 | 🌀 |
| 알레르기 | 알레르기/항히스타민 | 🌺 |
| 제산제 | 위식도역류/제산제 | 🫀 |

---

## 글쓰기 규칙

### 1. 타이틀 공식

```
{의약품명} 최저가 가격 | 성분 효과 {사용법/복용법} 부작용까지
```

- 외용제·연고 → "사용법"
- 복용하는 약 → "복용법"
- barkiry 딥링크 없는 제품 → "최저가 가격" 제거
  - 예: `콘택600 성분 효과 | 코감기약 복용법 부작용 총정리`
- **title과 h1은 반드시 동일**

### 2. H2 소제목 규칙 (PAA 형식)

> H2 = {의약품명} + 핵심 키워드 + 질문형
> 이유: 키워드 → 검색 노출(SEO), 질문형 → Google PAA 박스 인용 동시 달성
> "미녹시딜 사용법" 검색 → H2에 "사용법" 없으면 해당 쿼리 노출 안 됨

| 섹션 | 소제목 형식 | 필수 키워드 |
|------|-----------|------------|
| 1 | {의약품명} 성분은 무엇인가요? | 성분 |
| 2 | {의약품명} 효과가 나타나려면 얼마나 걸리나요? | 효과 |
| 3 | {의약품명} 사용법은 어떻게 되나요? (외용) / 복용법은 어떻게 되나요? (복용) | 사용법/복용법 |
| 4 | {의약품명} 가격은 얼마인가요? | 가격 |
| 5 | {의약품명} 부작용은 어떤 게 있나요? | 부작용 |
| 6 | {의약품명} 주의사항은 무엇인가요? | 주의사항 |
| 7 | {의약품명} 보관할 때 주의할 점은 무엇인가요? | 보관법 |

### 3. 기존 글 H2 형식 전환 방침

> 기존 글의 H2 소제목은 `{의약품명} 성분 분석`, `{의약품명} 효능과 효과` 형식이다.
> 새 PAA 형식으로 전환 시 아래 절차를 따른다.

1. **신규 글**: 처음부터 PAA 형식으로 작성 (즉시 적용)
2. **기존 글 수정**: 해당 글 전체를 수정할 때만 소제목 함께 변경 (부분 수정 금지)
3. **일괄 전환**: 카테고리 단위로 진행. `verify-style.js --category {slug}`로 검증 후 커밋

> ⚠️ 소제목만 단독으로 바꾸면 `verify-facts.js`의 섹션 매핑이 깨질 수 있으므로 반드시 전체 글 수정과 함께 진행한다.

### 4. SGE 직접답변 형식

heroDescription 첫 2문장은 SGE 직접답변 대상:
- 100자 이내, 단정형(~예요), 숫자·조건 포함
- "~할 수 있어요", "~로 알려져 있어요" 금지
- 각 H2 첫 문장도 직접답변 후보

### 5. 날짜 규칙

- `datePublished`: 글 최초 작성일 (YYYY-MM-DD)
- `dateModified`: 글 수정일 (YYYY-MM-DD)
- **신규 작성 시**: 둘 다 오늘 날짜
- **수정 시**: `datePublished` 유지, `dateModified`만 오늘 날짜로 갱신
- **소스 갱신 시**: `dateModified` 반드시 갱신

### 6. 문체 규칙

- **구어체**: "~해요", "~이에요", "~예요" (존댓말)
- **문어체 금지**: "~합니다", "~입니다", "~됩니다"
- `metaDescription`만 예외적으로 문어체 허용
- 작성자: **"의약품 에디터"** (모든 카테고리 동일)

### 7. 섹션별 텍스트 공식

```
1문장: 독자 상황 짚기
2문장: 이 소제목의 답을 바로 줌 (결론 먼저)
3~5문장: 왜 그런지, 예외는 뭔지, 실제 부딪히는 상황
[시각화 필요 시 여기]
1~2문장: 행동 유도 또는 다음 섹션 궁금증 열기
```

### 8. 섹션 시작 패턴 다변화 (같은 글에서 전부 다르게)

- 질문형: "이 약 공복에 써도 되나요?"
- 경고형: "이 조합은 심혈관 위험이 있어요."
- 숫자형: "4개월. 효과를 판단하려면 최소 이 기간이 필요해요."
- 반전형: "효과는 좋은데, 중단하면 다시 빠져요."
- 사례형: "두피 자극이 심하다면 폼 타입으로 바꾸면 돼요."

### 9. 단락 연결

- 접속사(또, 다만, 그럼에도) 시작 금지
- 다음 단락 첫 문장 = 새로운 사실로 자연 연결

### 10. 어미 변주

- 3문장 연속 같은 어미 금지
- ~예요/~이죠/~돼요/~있어요/~나요 섞어 쓴다
- **"거든요" 사용 금지** (조잡한 인상)

### 11. 빈 문장 금지

- "이 글에서는 ~에 대해 알아볼게요" → 삭제
- "전문가와 상담하세요" → "약사나 의사에게 확인하세요"로 구체화
- "확인하세요" → 확인할 내용을 문장에 포함

---

## 글 구조 (Spoke Article)

### 필수 구성

- **products**: `[]` (빈 배열)
- **faq**: 정확히 3개
- **sections**: 6개 (가격 섹션 포함 시 7개)

### H2 고정 순서 (절대 규칙)

| 순서 | 소제목 형식 | 필수 요소 | 비고 |
|------|-----------|----------|------|
| 1 | `{의약품명} 성분은 무엇인가요?` | ingredients 배열 필수 | - |
| 2 | `{의약품명} 효과가 나타나려면 얼마나 걸리나요?` | - | - |
| 3 | `{의약품명} {사용법/복용법}은 어떻게 되나요?` | - | 외용→사용법, 복용→복용법 |
| 4 | `{의약품명} 가격은 얼마인가요?` | PriceCTA | barkiry 딥링크 있을 때만 |
| 5 | `{의약품명} 부작용은 어떤 게 있나요?` | - | - |
| 6 | `{의약품명} 주의사항은 무엇인가요?` | - | - |
| 7 | `{의약품명} 보관할 때 주의할 점은 무엇인가요?` | - | - |

순서 변경 절대 금지. 가격 섹션 없으면 6개, 있으면 7개.

### 성분 테이블 (ingredients)

1번 섹션에만 포함:

```typescript
ingredients: [
  { type: "주성분", name: "성분명", amount: "용량", role: "역할" },
  { type: "첨가제", name: "성분명", role: "역할" },
]
```

- `amount`: 주성분 필수 (예: "10mg/g", "500mg")
- `role`: 한글로 간결하게 (예: "해열·진통", "상처 치유 촉진")

### FAQ 규칙

- 정확히 3개
- 질문 형식: 실제 PAA 검색 패턴 기반
  - 예: "미녹시딜 효과가 나타나려면 얼마나 걸리나요?"
  - 예: "미녹시딜을 끊으면 다시 빠지나요?"
- 답변: 구어체, 2~4문장
- **저항 FAQ 필수**: 3개 중 1개 이상은 실패·예외·중단 시나리오
  - "안 되면", "부작용이 나타나면", "효과가 없으면", "즉시 중단" 등

### 섹션 본문 규칙

- 각 섹션 최소 3문단
- 각 문단 최소 2~3문장
- 전문용어 뒤 괄호 설명 필수: "아시아티코사이드(Asiaticoside)"
- 총 글자 수: 1700~2000자 (verify-style.js 기준)

---

## 숫자 정확도 (절대 규칙)

- "만 N세", "1일 N회", "1회 N정" 등 숫자는 소스 JSON과 정확히 일치
- 소스에 "1일 3~4회"면 글에도 "1일 3~4회"만 허용
- `pre-commit-check.js`가 자동 대조, 불일치 시 커밋 차단

---

## 발키리(barkiry) 딥링크 규칙

| 조건 | 처리 |
|------|------|
| barkiryProductId 있음 | `barkiri.com/products/{id}` 직접 링크 |
| externalSearchUrl 있음 | 해당 URL |
| barkiryQuery만 있음 | `barkiri.com/search?query={query}` |
| 셋 다 없음 | CTA 버튼 자동 숨김, 타이틀에서 "최저가 가격" 제거 |

딥링크 유효성 확인:
```bash
curl -I "https://barkiri.com/products/p135"  # 200이면 유효
```

---

## UI 컴포넌트 규칙

### PriceCTA (최저가 버튼)
- 위치: 사용법/복용법 섹션 직후 (page.tsx `showPriceAfter` 로직)
- 딥링크 없는 제품: 자동 숨김 (`return null`)

### RelatedSpokes (내부링크)
- 최대 3개
- PriceCTA 바로 아래 배치

### CategorySidebar (사이드바)
- PC에서만 표시 (`hidden lg:block`)
- 같은 카테고리 전체 spoke 목록
- `sticky top-24`

### AdSlot (광고 슬롯)
- 제품 카드 아래: `<AdSlot slot="top" />`
- 가격 비교 아래: `<AdSlot slot="hero" />`
- 작성자 카드 위: `<AdSlot slot="bottom" />`
- 모바일 하단 고정: `<AdSlot slot="anchor" />`

---

## 파일 구조

```
pharm-jjyu/
├── app/
│   ├── [category]/[slug]/page.tsx  ← Spoke 페이지 (수정 금지)
│   ├── [category]/page.tsx         ← Hub 페이지 (수정 금지)
│   └── about/page.tsx
├── components/                     ← 공통 컴포넌트 (수정 금지)
│   ├── PriceCTA.tsx
│   ├── ProductCard.tsx
│   ├── RelatedSpokes.tsx
│   ├── CategorySidebar.tsx
│   ├── FAQSection.tsx
│   ├── IngredientTable.tsx
│   └── AdSlot.tsx
├── data/
│   ├── articles/                   ← ★ 에이전트 작업 영역
│   │   ├── index.ts                (수정 금지)
│   │   ├── 탈모.ts                 (hub + spokes import)
│   │   ├── 탈모-1.ts ~ 탈모-N.ts  ← spoke 글
│   │   └── {카테고리}.ts
│   └── products/                   ← ★ 에이전트 작업 영역
│       ├── index.ts                (수정 금지)
│       └── {카테고리}.ts
├── source-data/                    ← 소스 JSON (읽기 전용)
│   ├── schema.json
│   └── {slug}.json
└── scripts/
    ├── fetch-source.js             ← 소스 수집
    ├── verify-facts.js             ← Layer 2: 팩트 검증
    ├── verify-style.js             ← Layer 3: 문체 검증
    ├── verify-selfcheck.js         ← Layer 4: 역추출 대조
    └── pre-commit-check.js         ← Git hook 검증
```

---

## Agent Teams 규칙

- **1 에이전트 = 1 카테고리** (절대 규칙)
- 다른 에이전트 카테고리 파일 수정 금지
- `components/`, `app/`, `lib/types.ts`, `data/*/index.ts` 수정 금지

### 작업 순서

1. barkiry에서 딥링크 유효 제품 선정
2. `source-data/{slug}.json` 소스 확보 (없으면 `fetch-source.js` 실행)
3. `data/products/{카테고리}.ts` 제품 데이터 추가
4. `data/articles/{카테고리}.ts` hub spokes 엔트리 추가
5. **Step 0 (Q1~Q4) 먼저 답한 후** spoke 글 작성
6. `verify-facts.js`, `verify-style.js`, `verify-selfcheck.js` 모두 PASS 확인
7. `npm run build` 통과 후 커밋

### 커밋 메시지 형식

```
{카테고리} {N}개 spoke 글 추가
```

---

## 배포 아키텍처 (절대 변경 금지)

> **2026-03-31 사고 기록**: Worker(SSR) 방식 → 25MB 초과 → 3일간 사이트 다운.
> 아래 설정을 변경하면 사이트가 죽는다. 절대 건드리지 않는다.

| 항목 | 값 | 변경 시 결과 |
|------|---|-------------|
| `next.config.ts` output | `"export"` (SSG) | Worker 25MB 초과로 배포 불가 |
| `next.config.ts` trailingSlash | `true` | spoke 페이지 전체 404 |
| `wrangler.toml` pages_build_output_dir | `"out"` | Cloudflare가 빌드 결과물 못 찾음 |
| `package.json` build 스크립트 | `generate-article-json.mjs && next build && clean-out.mjs` | clean-out 빠지면 20,000 파일 제한 초과 |
| `scripts/clean-out.mjs` | RSC .txt 파일 삭제 | 없으면 28,000+ 파일 → 배포 거부 |

### 금지 사항
- `output: "export"` 를 제거하거나 `"standalone"` 등으로 변경 금지
- `@opennextjs/cloudflare` 재도입 금지
- `trailingSlash: true` 제거 금지
- `scripts/` 폴더가 `.gitignore`에 포함되어 있으므로, 새 스크립트 추가 시 `git add -f` 필수

---

## 빌드 & 검증

```bash
npm run build                                   # 빌드 + 딥링크 검증
node scripts/verify-facts.js --slug {slug}      # 팩트 대조
node scripts/verify-style.js --slug {slug}      # 문체 검증
node scripts/verify-selfcheck.js --slug {slug}  # 역추출 대조
node scripts/verify-style.js --category {slug}  # 카테고리 단위 검증
```
