# pharm.jjyu.co.kr 규칙서

> 글자수·금지어·섹션 타이틀 등 세부 기준은 `scripts/quality-config.json`이 단일 진실 원천.

## 1. 소스 JSON = 유일한 데이터 원천
- `source-data/{slug}.json` 필수. 없으면 `node scripts/fetch-source.js --slug {slug}` 실행.
- AI 학습 지식·웹 검색으로 효능·용법·부작용·주의사항 작성 **절대 금지**.
- 정량 데이터(숫자, 용량, 성분명, 함량, 연령)는 소스 원문 그대로. 가공·해석·추론 금지.

## 2. API 타입 판별
- `efcyQesitm` 필드 → **의약품** (e약은요). 템플릿: `data/articles/탈모-1.ts`
- `MAIN_FNCTN` 필드 → **건강기능식품** (식품안전나라). 템플릿: `data/articles/유산균-1.ts`
- JSX 렌더링 참조: `preview-nextjs-template.jsx` / `preview-듀오락유산균.jsx`

## 3. 글 작성
- spoke 작성/리라이트는 `.claude/agents/writer.md` 에이전트 호출.
- 출력은 `_workspace/02_writer_draft.ts` → 검증 통과 후 사람이 `data/articles/*.ts`에 반영.

## 4. 글쓰기 핵심 규칙
- **문체**: `~해요/~이에요/~예요`. `~합니다/~입니다` 금지. `metaDescription`만 문어체 허용.
- **heroDescription**: 80~150자. 소스 팩트 리드. 질문형(`~하셨나요?`) 금지. 같은 카테고리 내 첫 5자 중복 금지.
- **동일 성분 제품군**: 서로 다른 팩트 포인트를 앵커로 사용 (복용 시점/제형/연령/겸용 효능 등 교차).
- **FAQ**: 정확히 3개. 1개 이상은 실패·예외·중단 시나리오.
- **날짜**: 신규 `datePublished=dateModified=오늘`. 수정 시 `datePublished` 유지, `dateModified`만 갱신.

## 5. 타이틀 공식
```
barkiry 있음: {제품명} 최저가 가격 | 성분 효과 {복용법/사용법} 부작용까지
barkiry 없음: {제품명} 성분 효과 | {카테고리} {복용법/사용법} 부작용 총정리
```
외용제·연고 → "사용법" / 경구·건기식 → "복용법". `title`=`h1` 동일.

## 6. 딥링크 (절대 삭제 금지)
`externalSearchUrl`(네이버 쇼핑 딥링크) = 수익 핵심. 삭제·누락 금지.
barkiryProductId → `barkiri.com/products/{id}` / externalSearchUrl → 그대로 / barkiryQuery → `barkiri.com/search?query={query}` / 없음 → 가격 섹션 생략.

## 7. 수정 금지
`app/** components/** lib/types.ts data/articles/index.ts data/articles/build-all.ts data/products/index.ts`
작업 영역: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`

## 8. 배포 (절대 변경 금지)
`next.config.ts output="export"`, `trailingSlash=true`, `wrangler.toml pages_build_output_dir="out"`. 위반 시 사이트 다운.
**전체 빌드 푸시 금지.** 작업 파일만 커밋: `data/articles/*.ts`, `data/products/*.ts`, `source-data/*.json`.

## 9. 검증
```bash
npm run quality                                  # Layer 1~4 전수 검증 (verify-all.js)
node scripts/audit-hero.js --category {cat}      # heroDescription 품질
node scripts/verify-deeplinks.js                 # 딥링크 200 응답 확인
```
