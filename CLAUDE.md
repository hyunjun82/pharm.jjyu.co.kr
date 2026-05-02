# pharm.jjyu.co.kr 규칙서

> 글자수·금지어·섹션 타이틀 등 세부 기준은 `scripts/quality-config.json`이 단일 진실 원천.

## 1. 소스 JSON = 유일한 데이터 원천
- `source-data/{slug}.json` 필수. 없으면 `node scripts/fetch-source.js --slug {slug}` 실행.
- AI 학습 지식·웹 검색으로 효능·용법·부작용·주의사항 작성 **절대 금지**.
- 정량 데이터(숫자, 용량, 성분명, 함량, 연령)는 소스 원문 그대로. 가공·해석·추론 금지.
- **slug ↔ source 일치 검증**: 글의 주성분이 source `permitItemIngrName`과 일치해야 함. 불일치 시 글 자체가 잘못된 약 기준으로 작성된 거라 폐기·재작성 (피나원 사고 = 알레르기약을 탈모약으로 둔갑한 사례).

## 2. API 타입 판별
- `efcyQesitm` 필드 → **의약품** (e약은요). 템플릿: `data/articles/탈모-1.ts`
- `MAIN_FNCTN` 필드 → **건강기능식품** (식품안전나라). 템플릿: `data/articles/유산균-1.ts`
- 자연스러운 톤·구조 모범: `data/articles/탈모-1.ts`의 `미녹시딜-템플릿v2`, `프로페시아`, `헤어그로`, `아보다트`, `로게인`, `판토가` 6개 entry. 신규 글 작성 시 이 6개를 참고해 검색의도 분기 + 본문 차별화 적용.

## 3. 글 작성
- spoke 작성/리라이트는 `.claude/agents/writer.md` 에이전트 호출.
- 출력은 `_workspace/02_writer_draft.ts` → 검증 통과 후 사람이 `data/articles/{카테고리}-N.ts`에 반영.
- **검색의도 분기**: 글마다 검색의도 1개 명시 (오리지널·제네릭·외용·여성·전립선이력·복합영양 등). 같은 성분 다른 제품끼리 본문이 70%+ 매칭되면 doorway → FAIL.

## 4. 글쓰기 핵심 규칙
- **문체**: `~해요/~이에요/~예요`. `~합니다/~입니다` 금지. `metaDescription`만 문어체 허용.
- **금지 표현 (AI 클리셰)**: `찾고 계시죠?`, `눈에 띄시죠?`, `알아보고 계시죠?`, `걱정되시죠?`, `처음 시작하거나 제품을 바꿀 때` 등 가짜 공감 후킹.
- **받침 조사 검증**: 받침 없는 글자 + `은` 금지 (예: `아보다트은` ✗ → `아보다트는` ✓). `이/가`, `을/를`, `과/와`도 동일.
- **heroDescription**: 80~150자. 첫 줄에 핵심 답(검색 키워드 매칭 정보). 질문형(`~하셨나요?`) 금지. 같은 카테고리 내 첫 5자 중복 금지.
- **출처 표기**: 본문 안에 `식약처 허가사항`, `품목번호 OOOOOOOOO`, `e약은요` 등 1회 이상 자연 인용. 임상 수치는 출처와 함께 (예: `1년 임상시험에서`).
- **소스 외 정량 데이터 금지**: source-data에 없는 숫자(예: 5년 90%, DHT 93% 같은) 임의 사용 금지.
- **동일 성분 제품군**: 검색의도별로 본문 축 차별화 (오리지널은 5년 데이터, 제네릭은 가격 절감 근거, 외용은 도포 단계 등).
- **FAQ**: 정확히 3개. 1개 이상은 실패·예외·중단 시나리오. 본문 중복 금지.
- **날짜**: 신규 `datePublished=dateModified=오늘`. 수정 시 `datePublished` 유지, `dateModified`만 갱신.

## 5. 타이틀 공식
```
barkiry 있음: {제품명} 최저가 가격 | 성분 효과 {복용법/사용법} 부작용까지
barkiry 없음: {제품명} 성분 효과 | {카테고리} {복용법/사용법} 부작용 총정리
```
외용제·연고 → "사용법" / 경구·건기식 → "복용법". `title`=`h1` 동일.
v3 권장: 제품명 + 핵심 차별화 1개 (예: `마이녹실액3% 미녹시딜 효과·가격·부작용 | 1일 2회 4개월 사용법`).

## 6. 딥링크 (절대 삭제 금지)
`externalSearchUrl`(네이버 쇼핑 딥링크) = 수익 핵심. 삭제·누락 금지.
barkiryProductId → `barkiri.com/products/{id}` / externalSearchUrl → 그대로 / barkiryQuery → `barkiri.com/search?query={query}` / 없음 → 가격 섹션 생략.
**Product `image` 필드 비우면 안 됨**. ProductCard에 빈 회색 박스가 노출됨. `/images/barkiri-{slug}.webp` 형식으로 채우거나 source-data의 `itemImage`(nedrug URL) 사용.

## 7. 수정 금지
`app/** components/** lib/types.ts data/articles/index.ts data/articles/build-all.ts data/products/index.ts next.config.ts wrangler.toml`
작업 영역: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`, `source-data/*.json`

## 8. 배포 — 변경 글만 부분 배포 (자동 빌드 OFF 모드)

### 사전 1회 설정 (사용자가 직접):
1. [Cloudflare 대시보드](https://dash.cloudflare.com/d2e4e8fa6127e6e2ba40e48fe715aeef/pages/view/pharm-jjyu-co-kr/settings/builds-deployments) → **Pause builds** (자동 빌드 OFF)
2. [API 토큰 발급](https://dash.cloudflare.com/profile/api-tokens) — Custom Token, Cloudflare Pages:Edit 권한
3. `.env.local`에 저장 (gitignore됨):
   ```
   CLOUDFLARE_API_TOKEN=발급_토큰
   CLOUDFLARE_ACCOUNT_ID=d2e4e8fa6127e6e2ba40e48fe715aeef
   ```

### 일상 워크플로우 (글 1개 작성 → 라이브 2~3분):
```bash
# 1) 글 작성/수정 → data/articles/{카테고리}-N.ts
# 2) 변경된 글만 부분 빌드 + Cloudflare 직접 배포 (전체 빌드 X)
npm run deploy                          # git diff 자동 감지
npm run deploy:category 탈모            # 카테고리 전체
npm run deploy:slugs 탈모/미녹시딜       # 특정 슬러그만
```
- 부분 빌드 시간: 1~2분 (전체 11분 → 1/5)
- 라이브 반영: 30초~1분 (Cloudflare 변경 파일만 자동 감지)
- **git push는 코드 백업 용도**. 실제 배포는 wrangler가 담당.
- `prepush` 훅이 `verify-all.js` 실행. 검증 통과 못 하면 푸시 차단.

### 비상 시 전체 빌드 (사용 자제):
```bash
npm run build && git push   # Cloudflare 자동빌드가 도는 환경에선 11분
```

## 9. 검증
```bash
npm run quality                                  # Layer 1~4 전수 검증 (verify-all.js)
node scripts/audit-hero.js --category {cat}      # heroDescription 품질
node scripts/verify-deeplinks.js                 # 딥링크 200 응답 확인
node scripts/verify-style.js                     # 문체·AI클리셰·받침 조사
node scripts/verify-facts.js                     # source-data와 글 정량 일치
node scripts/verify-source.js                    # slug ↔ source 매핑 정확성
```
검증 통과한 글만 `npm run deploy`로 배포. 통과 못 하면 자동 차단.
