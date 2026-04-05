# pharm.jjyu.co.kr 규칙서

> 에이전트가 `data/articles/*.ts`에 글을 작성할 때만 읽는 파일.
> 세부 품질 규칙(글자수·금지어·섹션 타이틀)은 `scripts/quality-config.json`이 단일 진실 원천.

---

## 1. 글 작성 전 필수 2단계

### Step A — 템플릿 파일 Read (생략 금지)

작성할 카테고리의 기존 spoke 파일과 **미리보기 JSX** 파일을 반드시 먼저 읽는다.

#### ① 글 데이터 템플릿 (TypeScript — 섹션·성분·FAQ 구조 기준)
```
의약품 카테고리  → data/articles/탈모-1.ts        (미녹시딜 항목 참조)
건강기능식품     → data/articles/유산균-1.ts       (종근당락토핏골드 항목 참조)
```

#### ② 미리보기 JSX 템플릿 (실제 사이트 렌더링 구조 기준)
```
의약품 카테고리  → preview-nextjs-template.jsx    (종근당락토핏골드 렌더링 참조)
건강기능식품     → preview-듀오락유산균.jsx         (듀오락유산균 렌더링 참조)
```

> 두 파일을 모두 읽어야 한다. ①은 TypeScript 데이터 구조, ②는 실제 화면 출력 구조(섹션 순서·아이콘 색상·PriceCTA 위치·사이드바)를 확인하기 위해 필요하다.

파일 구조·섹션 순서·ingredients 배열·FAQ 형식 모두 템플릿을 그대로 따른다.

### Step B — 소스 JSON Read (생략 금지)

```
source-data/{slug}.json  없으면 → node scripts/fetch-source.js --slug {slug} 실행 후 중단
```

> ⚠️ 소스 JSON 데이터만 사용. AI 학습 지식·웹 검색으로 효능·용법·부작용·주의사항을 작성하면 절대 안 된다.

---

## 2. API 타입 판별 → 소스 필드 매핑

소스 JSON에 `efcyQesitm` 필드가 있으면 **의약품**, `MAIN_FNCTN` 필드가 있으면 **건강기능식품**.

### 의약품 (e약은요 API)

| 소스 필드 | 섹션 H2 |
|-----------|---------|
| itemName 괄호 안 성분 | 성분은 무엇인가요? |
| efcyQesitm | 효과가 나타나려면 얼마나 걸리나요? |
| useMethodQesitm | 사용법/복용법은 어떻게 되나요? |
| seQesitm | 부작용은 어떤 게 있나요? |
| atpnQesitm | 주의사항은 무엇인가요? |
| depositMethodQesitm | 보관할 때 주의할 점은 무엇인가요? |

섹션 수: barkiry 링크 없으면 6개, 있으면 7개(가격 섹션 추가).

### 건강기능식품 (식품안전나라 API)

| 소스 필드 | 섹션 H2 |
|-----------|---------|
| BASE_STANDARD + SUNGSANG | 성분은 무엇인가요? |
| MAIN_FNCTN | 효과가 나타나려면 얼마나 걸리나요? |
| SRV_USE | 복용법은 어떻게 되나요? |
| INTAKE_HINT1 | 주의사항은 무엇인가요? (이상사례 포함, 부작용 섹션 없음) |
| PRSRV_PD + DISTB_PD | 보관할 때 주의할 점은 무엇인가요? |

섹션 수: barkiry/externalSearchUrl 없으면 5개, 있으면 6개(가격 섹션 추가).

---

## 3. 타이틀 공식

```
barkiry 링크 있음:  {제품명} 최저가 가격 | 성분 효과 {복용법/사용법} 부작용까지
barkiry 링크 없음:  {제품명} 성분 효과 | {카테고리} {복용법/사용법} 부작용 총정리
```

- 외용제·연고 → "사용법" / 복용하는 약·건강기능식품 → "복용법"
- `title`과 `h1` 반드시 동일

---

## 4. 딥링크 처리 (절대 삭제 금지)

> `externalSearchUrl`은 **네이버 쇼핑 딥링크** (`search.shopping.naver.com`)다. 수익 핵심 필드이므로 어떤 경우에도 삭제·누락 금지.

| 조건 | 처리 |
|------|------|
| barkiryProductId 있음 | `barkiri.com/products/{id}` |
| externalSearchUrl 있음 | 해당 URL (= 네이버 쇼핑 딥링크) |
| barkiryQuery만 있음 | `barkiri.com/search?query={query}` |
| 셋 다 없음 | 가격 섹션 생략, 타이틀에서 "최저가 가격" 제거 |

---

## 5. 글쓰기 핵심 규칙

- **문체**: `~해요 / ~이에요 / ~예요` 구어체. `~합니다 / ~입니다` 금지. `metaDescription`만 문어체 허용.
- **숫자**: "1일 N회", "1회 N포" 등 모든 숫자는 소스 JSON과 정확히 일치. 임의 변경 금지.
- **FAQ**: 정확히 3개. 1개 이상은 실패·예외·중단 시나리오("효과 없으면", "부작용 나타나면" 등).
- **날짜**: 신규 작성 시 `datePublished` = `dateModified` = 오늘 날짜. 수정 시 `datePublished` 유지.

---

## 5-1. 글쓰기 에이전트 (상세 규칙 위임)

> 아래 에이전트 파일에 상세 글쓰기 규칙이 있다. 글 작성 시 반드시 읽을 것.

- `.claude/agents/article-writer.md` — 콘텐츠 차별화, 서론(heroDescription), 본문 섹션 작성 규칙
- `.claude/agents/seo-reviewer.md` + `data/synonyms.json` — SEO 동의어 매핑, 타이틀 중복 방지

---

## 6. 카테고리 목록

| slug | 타입 | 템플릿 참조 파일 |
|------|------|----------------|
| 탈모·연고·감기·진통제·무좀·설사·소화제·안약·구강·파스·영양제·여성건강·외상소독·두드러기·구충제·변비·알레르기·제산제 | 의약품 | `data/articles/탈모-1.ts` |
| 유산균·(향후 추가 건강기능식품 카테고리) | 건강기능식품 | `data/articles/유산균-1.ts` |

> 건강기능식품 카테고리는 유산균 외에도 추가될 수 있다. 새 카테고리라도 `MAIN_FNCTN` 필드가 있으면 건강기능식품 규칙을 따른다.

---

## 7. 수정 금지 파일

```
app/**         components/**      lib/types.ts
data/articles/index.ts            data/articles/build-all.ts
data/products/index.ts
```

에이전트 작업 영역: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`

---

## 8. 배포 경고 (절대 변경 금지)

> 2026-03-31: SSR Worker 방식 → 25MB 초과 → 3일 다운. 아래 설정 건드리면 사이트 죽는다.

| 파일 | 값 |
|------|----|
| next.config.ts `output` | `"export"` |
| next.config.ts `trailingSlash` | `true` |
| wrangler.toml `pages_build_output_dir` | `"out"` |
| package.json build | `generate-article-json.mjs && next build && clean-out.mjs` |

---

## 9. 작성 후 검증 및 배포

### 검증 (로컬)
```bash
node scripts/verify-facts.js --slug {slug}      # 숫자·성분 ↔ 소스 대조
node scripts/verify-style.js --slug {slug}      # 문체·금지어
node scripts/verify-selfcheck.js --slug {slug}  # 팩트 역추출
npm run build                                    # 로컬 빌드 확인용
```

### 배포 규칙 (중요)
> **전체 빌드 푸시 금지.** 신규 작성·수정한 파일만 커밋 후 배포한다.

```
작업 파일만 커밋:
  data/articles/{카테고리}-N.ts   ← 신규/수정 글
  data/products/{카테고리}.ts     ← 제품 추가 시에만
  source-data/{slug}.json         ← 소스 추가 시에만

전체 재배포 트리거 금지:
  app/**  components/**  next.config.ts  wrangler.toml 건드리지 말 것
```
