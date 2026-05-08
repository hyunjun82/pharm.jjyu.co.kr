# pharm.jjyu.co.kr 규칙서 v2

> **색인율 1.3% 위기 대응판** (2026-05-07 시작). 7,617개 글 중 100개만 색인 = 구글이 사이트 전체를 doorway로 판정 중.
> v1의 "한 제품 = 한 글 공장" 모델 폐기. v2는 **본문 고유성 강제 + 검색의도 분기 + 클릭 유도** 3축.
> 글자수·금지어·동일도 임계값 등 세부 기준은 `scripts/quality-config.json`이 단일 진실 원천.

## 0. 핵심 철학 (왜 v1을 버리는가)

| 항목 | v1 (망함) | v2 (지금) |
|---|---|---|
| 모델 | 한 제품 = 한 글 양산 | 한 키워드 = 고유 의도 답 |
| 섹션 구조 | 모든 글 동일 (성분→효과→복용법→...) | 의도별 다중 템플릿 |
| 검증 | 문체·정량만 | 문체·정량 + **doorway** + **고유성** |
| 결과 | 색인 1.3%, 매출 0 | 회복 목표 6주 30%, 12주 60% |

수익 모델 = 전면광고 인터스티셜. **색인 안 되면 매출 0**. SEO가 유일한 살길.

---

## 1. 글의 3가지 작성 거부 조건

이 셋 중 **하나라도** 못 채우면 글로 안 만든다. writer 에이전트가 첫 단계에서 거부.

### 1-1. 검색의도 명시 (intent ≠ slug)
같은 카테고리 안에서 다른 글과 의도가 겹치면 안 됨. 의도 후보 풀:

| ID | 의도 | 본문 핵심축 |
|---|---|---|
| `price` | 가격 비교형 | 약국vs온라인, 라인업별, 경쟁 제품 |
| `safety` | 안전성 의심형 | 부작용 통계, 금기 대상, 약물 상호작용 |
| `usage_scenario` | 사용 시나리오형 | 출장·여행·임신·노인·아이 |
| `original_vs_generic` | 오리지널vs제네릭 | 가격 차이 근거, 효능 동등성 |
| `external_vs_oral` | 외용vs경구 | 흡수율, 부작용 차이, 환경별 선택 |
| `dose_compare` | 용량 차이 비교 | 5mg vs 10mg, 1정vs2정 |
| `family` | 가족형 호환 | 남녀노소 함께 복용 가능성 |
| `brand_trust` | 브랜드 신뢰형 | 제조사 역사, GMP, 매출 순위 |
| `combo` | 복합 영양 | 다른 성분과 결합 시너지 |
| `side_effect_avoid` | 부작용 회피형 | 부작용 적은 대체 옵션 비교 |

같은 카테고리 안에서 같은 의도 글이 5개 넘으면 추가 작성 금지 (의도 풀 고갈).

### 1-2. 고유 데이터 포인트 3개 (factual fingerprint)
이 글에만 있는, 같은 카테고리 다른 글에 절대 안 나올 사실 3개 이상. 후보:

- 식약처 품목번호 (9자리)
- 출시 연도, 제조사 GMP 인증 연도
- 알약 모양·색·각인 (예: "흰색 원형 양면분할선 'TY' 각인")
- 제조사 임상시험 표본 수 / 통계 수치
- 광고 카피·브랜드 슬로건 (예: "맞다 게보린")
- 가격 변동 이력 (출시가 → 현재가)
- 사용자 후기 빈출 시나리오 1개 (예: "야근 후 두통", "장거리 운전")
- 식약처 회수·과징금 이력
- 보험 적용 여부, 일반의약품/전문의약품 분류

writer는 source-data + 외부 신뢰 출처(식약처 공시, 제조사 공식, 임상논문 DOI)에서 추출.
3개 미만이면 작성 거부 → "데이터 부족, 글 만들지 말 것" 큐로 이동.

### 1-3. 사용자 5초 답 (above-the-fold)
heroDescription 첫 80자 안에 검색자가 원하는 답 한 줄.

❌ "탈모 치료제를 찾고 계시죠?" (질문형, 답 없음)
✅ "프로페시아는 1mg 피나스테리드 경구 탈모약, 5년 임상 90% 진행 중단."

---

## 2. doorway 박멸 — 자동 빌드 차단 (Layer 5)

`scripts/verify-doorway.js` 실행. 같은 카테고리 안에서:

- **본문 Jaccard 유사도 > 0.70** → FAIL (빌드 차단)
- **섹션 제목 100% 일치** AND **본문 유사도 > 0.50** → FAIL
- **heroDescription 첫 5자 중복** (카테고리 내) → FAIL
- **동일 문장 4개 이상 공유** → FAIL

`prepush` 훅에 포함. 통과 못 하면 푸시·배포 자체 불가.

---

## 3. 고유성 검증 — 자동 빌드 차단 (Layer 6)

`scripts/verify-uniqueness.js` 실행. 글마다:

- 본문에서 추출한 **고유 사실(품목번호·연도·통계·각인 등) ≥ 3개**
- 추출된 사실 중 **카테고리 내 다른 글과 겹치지 않는 것 ≥ 2개**
- 이 둘 다 만족 못 하면 FAIL

각 글의 `_qa.uniqueFacts` 필드에 자동 기록 → 재검증 시 캐시 활용.

---

## 4. 본문 차별화 — 의도별 다중 섹션 템플릿

v1은 모든 글 `성분→효과→복용법→부작용→주의사항→보관법`. 봇한테 패턴 양산 시그널.
v2는 검색의도별로 **섹션 순서·제목·길이 비중**을 다르게.

### 의도 A `price`: 가격 비교형
1. (40%) 약국 vs 온라인 vs 해외 가격
2. (25%) 같은 성분 경쟁 제품 가격 매트릭스
3. (15%) 라인업별·용량별 단가
4. (20%) 성분·복용법 짧게 (참조용)

### 의도 B `safety`: 안전성 의심형
1. (35%) 식약처 부작용 보고 통계
2. (25%) 금기 대상자 (임산부·소아·간기능 저하 등)
3. (20%) 약물 상호작용
4. (20%) 안전 복용법 / 응급 시 대처

### 의도 C `usage_scenario`: 사용 시나리오형
1. (30%) 시나리오별 적합성 (운전·임신·등산 등)
2. (25%) 시나리오별 권장 용량
3. (25%) 휴대성·복용 편의성
4. (20%) 부작용 시나리오 대처

### 의도 D `original_vs_generic`
1. (30%) 오리지널과 제네릭의 효능 동등성 근거 (BE 시험)
2. (25%) 가격 차이 + 보험 차이
3. (25%) 제조사·라인업 차이
4. (20%) 처방 시 어느 쪽을 받게 되는가

### 의도 E `external_vs_oral`
1. (30%) 흡수율·작용 부위 차이
2. (25%) 부작용 차이 (전신vs국소)
3. (25%) 시나리오별 선택 가이드
4. (20%) 병행 사용 가능성

(나머지 의도 F~J는 `scripts/quality-config.json`의 `intentTemplates`에 명시)

각 의도 템플릿마다 **금지 섹션 제목**도 정의됨. 예: `price` 의도에 "성분은 무엇인가요?" 같은 일반 제목 금지 → "라이프스타일별 가격대" 같은 의도-특화 제목 강제.

---

## 5. 소스 데이터 = 유일한 정량 원천 (v1 유지)

- `source-data/{slug}.json` 필수. 없으면 `node scripts/fetch-source.js --slug {slug}`.
- AI 학습 지식·웹 검색으로 효능·용법·부작용·주의사항 작성 **절대 금지**.
- 정량 데이터(숫자, 용량, 성분명, 함량, 연령)는 소스 원문 그대로.
- **slug ↔ source 일치 검증**: 글의 주성분이 source `permitItemIngrName`과 일치해야 함.

### v2 추가
- **고유 데이터 포인트는 source-data + 외부 신뢰 출처에서 가져옴**
  - 외부 출처 허용 리스트: drug.mfds.go.kr, nedrug.mfds.go.kr, foodsafetykorea.go.kr, pubmed.ncbi.nlm.nih.gov, 제조사 공식 도메인
  - 외부 출처 인용 시 글 본문에 도메인 명시 (예: "식약처 공시(drug.mfds.go.kr)에 따르면")
  - 외부 출처 인용 시 `source-data/{slug}.json`의 `external` 배열에 URL 기록 (재검증용)

---

## 6. API 타입 판별 (v1 유지)

- `efcyQesitm` 필드 → **의약품** (e약은요)
- `MAIN_FNCTN` 필드 → **건강기능식품** (식품안전나라)

---

## 7. 글쓰기 핵심 규칙 (v1 + v2 강화)

### 문체 (v1 유지)
- `~해요/~이에요/~예요`. `~합니다/~입니다` 금지. `metaDescription`만 문어체 허용.

### 금지 표현 (v2 확장)
v1 금지어 + 가짜 공감 후킹 (실제 글에서 발견된 것 전체):
- `찾고 계시죠?`, `눈에 띄시죠?`, `알아보고 계시죠?`, `걱정되시죠?`, `궁금하시죠?`, `고민되시죠?`
- `처음 시작하거나 제품을 바꿀 때`
- `~선택할 때 무엇을 봐야 할지 헷갈리시죠?`
- 발견 즉시 FAIL. 1회만 있어도 FAIL (관용 0).

### 받침 조사 (v2 신규)
- `verify-style.js`의 한글 받침 자동 검사:
  - 받침 없는 글자 + `은` 금지 (`아보다트은` ✗ → `아보다트는` ✓)
  - 받침 없는 글자 + `이` 금지 (단, 보조사 「~이」 예외 처리)
  - `을/를`, `과/와`, `으로/로` 동일

### heroDescription (v2 강화)
- 80~150자
- 첫 80자에 검색 답 (1-3 규칙)
- 질문형(`~하셨나요?`, `~인가요?`) 금지
- 같은 카테고리 내 첫 5자 중복 금지
- AI 클리셰 금지어 풀 적용

### 출처 표기 (v2 강화)
- 본문 안에 `식약처 허가사항`, `품목번호 OOOOOOOOO`, `e약은요` 등 **2회 이상** 자연 인용 (v1 1회→2회)
- 임상 수치는 출처와 함께 (예: `1년 임상시험에서`)
- 외부 출처 인용 시 도메인 명시 (5절 참고)

### 소스 외 정량 데이터 금지 (v1 강화)
source-data + 외부 화이트리스트 도메인 외 숫자(예: 5년 90%, DHT 93% 같은) **절대 금지**. 발견 시 FAIL.

### 동일 성분 제품군 (v1 → v2 강제)
검색의도별로 본문 축 차별화 (오리지널은 5년 데이터, 제네릭은 가격 절감, 외용은 도포 단계 등). doorway 검증(2절)이 자동 강제.

### FAQ
- 정확히 3개. 1개 이상은 실패·예외·중단 시나리오. 본문 중복 금지.
- **카테고리 내 FAQ 질문 동일 금지** (verify-style.js가 잡음)

### 날짜
- 신규 `datePublished=dateModified=오늘`. 수정 시 `datePublished` 유지, `dateModified`만 갱신.

---

## 8. 타이틀 공식 (v2 확장)

v1은 단일 공식 → 패턴 시그널. v2는 의도별 다중 공식.

**검색자가 입력하지 않는 토큰은 금지.** 연도(`2026`, `2025`), 괄호 부가 설명(`(3성분 제산제)`), 카테고리명 반복(`| 제산제 ...`), AI 후킹(`총정리`) 모두 제거. **타이틀 ≤ 50자, 핵심 검색어 + 핵심 숫자만.**

```
[price 의도]
{제품명} 가격 | 약국·온라인 최저가 {핵심숫자}
예: 겔포스엠4포 가격 | 약국·온라인 최저가 1포 850원 4포 3,400원

[safety 의도]
{제품명} 부작용 {핵심증상} | 금기 {대상}
예: 미녹시딜 부작용 가려움·홍반 | 금기 임산부·소아

[usage_scenario 의도]
{시나리오} {제품명} 써도 될까 | 권장량
예: 임산부 타이레놀 써도 될까 | 1회 500mg 1일 4회

[original_vs_generic]
{제품명} vs {제네릭명} 가격 차이 | 효능 동등성
예: 프로페시아 vs 피나스테리드 가격 차이 | 효능 동등성

[external_vs_oral]
{제품명} 외용 vs 경구 차이 | 흡수율·부작용
예: 미녹시딜 외용 vs 경구 차이 | 흡수율·부작용

[기본 (의도 미해당)]
{제품명} 성분·효과 | {복용법/사용법}·부작용
```

외용제·연고 → "사용법" / 경구·건기식 → "복용법". `title`=`h1` 동일.

---

## 9. 딥링크 (v1 유지) — 절대 삭제 금지

`externalSearchUrl`(네이버 쇼핑 딥링크) = 광고 클릭 트리거. 이게 전면광고 노출 경로. 삭제·누락 금지.
- barkiryProductId → `barkiri.com/products/{id}`
- externalSearchUrl → 그대로
- barkiryQuery → `barkiri.com/search?query={query}`
- 없음 → 가격 섹션 생략
- Product `image` 필드 비우면 안 됨 → `/images/barkiri-{slug}.webp` 또는 source-data `itemImage`

---

## 10. 수정 금지 (v1 유지)

`app/** components/** lib/types.ts data/articles/index.ts data/articles/build-all.ts data/products/index.ts next.config.ts wrangler.toml`
작업 영역: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`, `source-data/*.json`

---

## 11. 자동화 — Claude Managed Agents 워크플로우

v2는 글 양이 7,617개라 사람이 다 못 씀. **Anthropic Claude Managed Agents** (cloud-hosted) 활용.
공식 문서: https://platform.claude.com/docs/en/managed-agents/overview

### 두 가지 에이전트 시스템 구분

| 종류 | 위치 | 용도 |
|---|---|---|
| **Claude Code 서브에이전트** | `.claude/agents/*.md` | 로컬 개발·테스트, 사용자가 CLI에서 직접 호출 |
| **Managed Agents** | Anthropic 클라우드, YAML/API | 자동화 양산, 야간 배치, 7,617개 글 리라이트 |

`.claude/agents/writer.md`는 **로컬 시범용**. 실제 양산은 `agents-config/*.yaml`을 `ant beta:agents create`로 배포해서 돌림.

### 베타 헤더 (필수)

- 모든 Managed Agents 요청: `anthropic-beta: managed-agents-2026-04-01`
- Dreams: 추가로 `dreaming-2026-04-21`
- Multi-agent + Outcomes는 **research preview** → https://claude.com/form/claude-managed-agents 에서 access 신청

### Coordinator: `pharm-article-lead`

```yaml
name: pharm-article-lead
model: claude-opus-4-7
system: |
  의약품/건기식 글 생산 코디네이터. CLAUDE.md v2 룰 준수.
  입력: { slug, mode: "new"|"rewrite", forceIntent? }
  플로우: source → intent → fact → writer → verifier (병렬 6 Layer) → outcomes 평가
tools:
  - type: agent_toolset_20260401  # 이게 있어야 sub-agent 위임 가능
multiagent:
  type: coordinator
  agents:
    - { type: agent, id: $SOURCE_FETCHER_ID }
    - { type: agent, id: $INTENT_ANALYST_ID }
    - { type: agent, id: $FACT_MINER_ID }
    - { type: agent, id: $WRITER_ID }
    - { type: agent, id: $VERIFIER_ID }
```

### Sub-agents (5종, 깊이 1만 허용)

1. **source-fetcher**: source-data/{slug}.json 확보
2. **intent-analyst**: 같은 카테고리 기존 글 의도 분석 → 빈 의도 1개 선택 + 차별화 축 3개
3. **fact-miner**: source-data + 외부 화이트리스트에서 고유 사실 후보 풀 추출 (10개+)
4. **writer**: `agents-config/04-writer.yaml` 정의 따라 의도-템플릿 기반 작성
5. **verifier**: 6 Layer 병렬 (Source/Fact/Style/SelfCheck/Doorway/Uniqueness)

**제약**:
- 최대 20개 unique agents / 25 concurrent threads
- coordinator는 같은 agent의 복사본을 동시에 여러 개 호출 가능 (예: writer 5개 병렬 = OK)
- sub-agent가 자기 sub-sub-agent를 못 부름 (depth=1)

### Outcomes Loop (Research Preview)

성공 기준 정의 → Claude가 self-evaluate하고 통과할 때까지 반복.
v2 성공 기준:
- 6 Layer 모두 PASS
- 사용자 5초 답 통과 (heroDescription 첫 80자 답)
- writer iteration ≤ 3회

실패 시 어느 Layer FAIL인지 writer에 피드백 → 재작성. 3회 초과 → human review 큐 (`_workspace/_failed/{slug}.md`).

### Dreams (야간 메모리 큐레이션)

매주 일요일 03:00 (cron). writer 에이전트의 memory store를 **재구성**해서 자주 틀리는 패턴을 보강.

```yaml
inputs:
  - type: memory_store
    memory_store_id: $WRITER_MEMORY_STORE_ID
  - type: sessions
    session_ids: [최근 7일 writer 세션 최대 100개]
model: claude-opus-4-7
instructions: |
  pharm-jjyu writer 에이전트의 메모리에서:
  1) 자주 틀리는 받침 조사 패턴 추출
  2) 검색의도 중복을 자주 일으키는 카테고리 식별
  3) 사용자 후기 시나리오 반복 패턴 파악
  CLAUDE.md 룰과 충돌하는 학습은 제외.
```

**중요**: Dreams는 입력 메모리를 **수정하지 않고**, 새 memory store를 출력함. 사람이 review 후 OK면 다음 세션부터 새 store 사용. NG면 폐기. **자동 반영 금지** = Anthropic 공식 가이드와 일치.

### 배포 명령어

```bash
# 1. 환경 정의
ant beta:environments create < agents-config/00-environment.yaml

# 2. sub-agents 먼저 (coordinator가 ID 참조)
SOURCE_ID=$(ant beta:agents create --transform id < agents-config/01-source-fetcher.yaml)
INTENT_ID=$(ant beta:agents create --transform id < agents-config/02-intent-analyst.yaml)
FACT_ID=$(ant beta:agents create --transform id < agents-config/03-fact-miner.yaml)
WRITER_ID=$(ant beta:agents create --transform id < agents-config/04-writer.yaml)
VERIFIER_ID=$(ant beta:agents create --transform id < agents-config/05-verifier.yaml)

# 3. coordinator (ID 변수 inject)
envsubst < agents-config/06-coordinator.yaml | ant beta:agents create

# 4. 실행
ant beta:sessions create \
  --agent "$COORDINATOR_ID" \
  --environment-id "$ENV_ID" \
  --input '{"slug":"아보다트","mode":"new"}'
```

### Rate limit (organization 단위)

- create 엔드포인트: 300 req/min
- read/stream: 600 req/min

7,617개 글 일괄 처리 시 rate limit 회피를 위해 큐잉 필요.

---

## 12. 검증 시스템 — 6층

```bash
npm run quality              # Layer 1~6 전수 (verify-all.js)

# 개별 레이어
node scripts/verify-source.js       # L1
node scripts/verify-facts.js        # L2
node scripts/verify-style.js        # L3
node scripts/verify-selfcheck.js    # L4
node scripts/verify-doorway.js      # L5 (NEW)
node scripts/verify-uniqueness.js   # L6 (NEW)

# 진단 도구
node scripts/audit-hero.js --category {cat}
node scripts/verify-deeplinks.js
```

`prepush` 훅이 6 Layer 전체 실행. 하나라도 FAIL이면 푸시 차단 → 배포 차단.

---

## 13. 배포 (v1 유지) — 변경 글만 부분 배포

자동 빌드 OFF 모드. `.env.local`에 `CLOUDFLARE_API_TOKEN` 보관.

```bash
npm run deploy                  # git diff 자동 감지
npm run deploy:category 탈모    # 카테고리 전체
npm run deploy:slugs 탈모/미녹시딜
```

---

## 14. 색인 회복 KPI

| 시점 | 색인율 목표 | 액션 |
|---|---|---|
| 0주 | 1.3% (현재) | v2 시스템 가동 |
| 2주 | 5%+ | 유산균 doorway 100건 리라이트 |
| 6주 | 30%+ | 유산균·탈모·영양제 카테고리 리라이트 완료 |
| 12주 | 60%+ | 전 카테고리 1차 리라이트 완료 |

매주 GSC `색인됨/제출됨` 추적. 회복 안 되는 글은 `noindex` 메타 추가 + 재작성 큐.

---

## 15. 비상 시 작업 우선순위

1. (P0) v2 검증 통과 못 하는 글 = 색인 안 됨 → 즉시 리라이트
2. (P1) 같은 카테고리 doorway 동일도 90%+ 글 → 통합 또는 의도 분기
3. (P2) 고유 사실 0개 글 → 데이터 보강 후 작성, 데이터 못 구하면 폐기
4. (P3) 의도 풀 고갈 카테고리 → 신규 글 작성 금지, 기존 글 강화로 전환
