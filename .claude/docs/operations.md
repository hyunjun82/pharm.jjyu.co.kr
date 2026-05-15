# pharm-jjyu 운영 디테일 (CLAUDE.md 보조 문서)

## 1. 4-Agent 파이프라인 상세

| 순서 | 에이전트 | 모델 | 도구 | 책임 |
|---|---|---|---|---|
| 1 | intent-classifier | sonnet | Read·Glob·Grep·Bash | searchIntent + anchor 결정, facts whitelist 생성 |
| 2 | writer | opus | Read만 | draft 작성 (facts 안에서만, AI 지식 격리) |
| 3 | verifier | sonnet | Read·Bash·Grep | 8항목 자동 검증 |
| 4 | reviewer | opus | Read·Edit·Bash·Glob | hero·anchor 차별화 확인 + data/articles 반영 |

FAIL시 violations를 writer에 재입력 (최대 3회). 3회 실패 시 사용자에게 보고.

## 2. 검증 8항목 (verify-draft.js)

| 규칙 | 검사 |
|---|---|
| R1-fact | 본문 모든 정량 데이터 ⊆ brief.facts.numericValues |
| R2-doorway | brief.forbiddenSentences와 5-gram overlap < 30% |
| R3-intent | sections.title 순서가 intent template과 일치 |
| R4-price | 가격 H2 존재 + 본문 "원" 3회 + brief.priceData 인용 |
| R5-density | 본문 100자당 숫자 ≥ 2.0 |
| R6-citation | 본문 1,000자당 식약처/품목번호/허가사항/임상 ≥ 1 |
| R7-style | 받침 조사 + forbiddenWords + ~합니다 부재 |
| R8-fakeEmpathy | 가짜 공감 후킹 6개 부재 |

## 3. 차별 앵커 8종

제형(form, 액제/폼/겔/캡슐) · 함량(dose, 3%/5%/1mg) · 연령(age, 성인/소아/노년) · 성별(gender, 여성/남성) · 시기(timing, 임신/수유) · 동반질환(comorbidity, 고혈압/간장애) · 가격대(priceTier, 고가/중가/저가) · 처방여부(prescription, 전문/일반).

의도 6 × 앵커 8 = **48 unique 조합**. 같은 ingredientGroup spoke 408개도 48조합에 분배해 본문 차별화.

## 4. 타이틀 공식 (의도별 6패턴)

```
A: {제품} 효과 {timeframe} | 부작용·{usage}·가격
B: {제품} 부작용 신호와 즉시 중단 기준 | 효과·가격
C: {제품} {복용법/사용법} | 효과·부작용·가격
D: {제품} 최저가 {minPrice}원~ | 약국별 가격 비교
E: {제품A} vs {제품B} 차이 | 효과·부작용·가격 비교
F: {제품} 단종·대체 | 같은 성분 다른 제품·가격
```

`title` = `h1`. 외용제·연고 → "사용법", 경구·건기식 → "복용법". D형은 "최저가" 100% 포함, 기타는 30%+.

## 5. 가격 H2 위치 (의도별)

| 의도 | 가격 H2 위치 |
|---|---|
| A 효과 | 4번째 (사용법 다음) |
| B 부작용 | 5번째 (효과 다음) |
| C 사용법 | 4번째 |
| D 가격 | **2번째 (효과 핵심 직후, 가격이 핵심)** |
| E 비교 | 5번째 |
| F 대안 | 4번째 |

D형 글은 본문 "원" 5회+, 그 외 의도는 3회+.

## 6. 폐기된 구 규칙 (변경 사유 추적)

| 구 규칙 | 폐기 사유 | 대체 |
|---|---|---|
| `.claude/agents/writer.md` 단일 호출 | 디렉토리 없었음, 메인 Claude 단독 작성으로 AI 지식 누설 | 4-agent 격리 파이프라인 |
| `_workspace/02_writer_draft.ts` 수동 출력 | 디렉토리 없었음 | 4-agent 체인이 _workspace 자동 관리 |
| "API 타입 판별" 수동 | 사람이 외울 필요 없음 | intent-classifier 자동 추론 |
| "prepush 훅" 명시했지만 비활성 | `.git/hooks/pre-push.sample`만 있고 동작 안 함 | `.claude/settings.json` Hooks로 부활 |
| "검색의도 분기 필수" 규칙만 있고 필드 없음 | SpokeArticle 타입에 searchIntent 없음 | `searchIntent` 필드 추가 |
| "가짜 공감 후킹 금지" 검증 없음 | forbiddenWords에 미등록 | 6개 추가 |
| 글자수 7,500~8,000자 | 정보 밀도 12%, 빈 원리 반복 68% | 2,000~3,500자, 정보 밀도 ≥ 2.0 강제 |
| 모든 글 self-canonical + 본문 70~95% 중복 | doorway 확정 | 의도×앵커 48조합으로 본문 차별화 |

## 7. SEO 수정 사항 (v2)

- `app/[category]/[slug]/page.tsx`:
  - Drug 스키마 `activeIngredient`: 단순 문자열 → `DrugStrength` 객체 배열 (`{@type, activeIngredient, strengthValue, strengthUnit}`)
  - Drug 스키마 `offers`: priceRange 있으면 `AggregateOffer (lowPrice~highPrice)`, 없으면 단일 `Offer`
  - 본문 가격: `priceRange.min~max` + storeCount 출력
- `components/RelatedSpokes.tsx`: anchor text 8종 순환 (효과·부작용·사용법·최저가·성분·주의사항·동성분·종합가이드)
- `lib/types.ts`: SpokeArticle에 searchIntent·differentiationAnchor·ingredientGroup·priceRange 4필드 추가

## 8. 배포 워크플로우 (자동 빌드 OFF 모드)

```powershell
# 사전 1회 설정
# 1) Cloudflare 대시보드: Pause builds
# 2) API 토큰 발급 → .env.local
#    CLOUDFLARE_API_TOKEN=...
#    CLOUDFLARE_ACCOUNT_ID=d2e4e8fa6127e6e2ba40e48fe715aeef

# 일상 배포
npm run deploy                        # git diff 자동 감지
npm run deploy:category 탈모          # 카테고리 전체
npm run deploy:slugs 탈모/미녹시딜    # 특정 슬러그

# 부분 빌드 시간: 1~2분, 라이브 반영: 30초~1분
```

`git push`는 코드 백업 용도. 실제 배포는 wrangler.

## 9. 비상 검증·복구 명령

```
npm run quality                                  # Layer 1~4 전수
node scripts/audit-hero.js --category {cat}      # heroDescription 품질
node scripts/verify-deeplinks.js                 # 딥링크 200 확인
node scripts/verify-style.js                     # 문체·받침·금지어
node scripts/verify-facts.js                     # source-data 대조
node scripts/verify-doorway.js {slug}            # 5-gram overlap
node scripts/verify-price.js --category {cat}    # 가격 H2·본문 텍스트
node scripts/rebuild-source-map.js               # source-map 재생성 (캐시 의존 없음)
```

## 10. 작업 영역 vs 수정 금지 (구 §7)

작업 가능:
- `data/articles/{카테고리}-N.ts`
- `data/products/{카테고리}.ts`
- `source-data/*.json`
- `_workspace/*` (자동, gitignore)

수정 금지 (재설계 1회 예외 후 freeze):
- `app/**`, `components/**`
- `lib/types.ts` (재설계 1회만 4필드 추가)
- `data/articles/index.ts`, `data/articles/build-all.ts`, `data/products/index.ts`
- `next.config.ts`, `wrangler.toml`
