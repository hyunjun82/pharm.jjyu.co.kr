# pharm.jjyu.co.kr 글 생산 규칙

> v3 (2026-06-11). 마스터 템플릿 `.claude/templates/master-quality.template.md` 기준. 디테일은 `.claude/docs/operations.md`. 검증 기준은 `scripts/quality-config.json`.

## 배포 규칙 (불가변 — 푸시 전 반드시 확인)

1. **일상 배포는 부분배포만.** 글 작성·수정 후 전체 푸시 빌드(11분) 금지:
   ```
   node scripts/deploy-incremental.mjs --slugs 탈모/아보다트,탈모/프로페시아
   ```
   바뀐 글만 빌드해 1~3분 내 실사이트 반영.
   **부분배포는 반드시 `_full-out/` 전체 스냅샷에 병합 후 스냅샷을 통째로 배포** (스크립트가 자동 처리, 스냅샷 없으면 차단). Cloudflare Pages는 매 배포가 전체 스냅샷이라 부분 빌드 out/만 올리면 나머지 페이지 전부 404 (2026-06-13 사고 — 롤백으로 복구). 스냅샷 최초 생성·갱신: `node scripts/deploy-incremental.mjs --full` (풀빌드+전체 배포, 11분).
2. **Cloudflare Pages "빌드 일시 중지" 상태 유지.** git push는 백업용 — push가 풀빌드를 트리거하면 안 됨.
3. **풀빌드는 템플릿/컴포넌트(`app/`, `components/`) 변경 시 1회만.** 절차: main에 merge → push → 대시보드에서 빌드 일시중지 해제 → 빌드 완료 확인 → 다시 일시중지.
4. **브랜치**: 실사이트 = `main`. 작업 브랜치에서 커밋했으면 main merge 전까지 실사이트 반영 안 됨 (프리뷰만 생성).
5. **배포 전 게이트 (순서 고정)**: ① `node scripts/build-write-brief.js {slug}`가 차단(NEEDS_REFETCH)이면 작성 금지 ② 작성 후 `node scripts/validate-article.js {slug} {draft}` PASS + `node scripts/score-article.js {slug} {draft}` SCORE PASS(표준 11편 대비 90% 미달 지표 있으면 재작성) ③ TS 구문 검사 ④ 그 다음에만 배포.
6. **pre-push 훅이 규칙을 강제함** (`.git/hooks/pre-push`): `app/`·`components/` 등 풀빌드 유발 파일이 섞인 푸시는 자동 차단. 의도된 풀빌드만 `ALLOW_FULL_BUILD=1`로 통과. 글(data/)만 푸시 시 부분배포 명령 자동 안내.

## 배치 운영 원칙

- **리라이트는 카테고리 단위로 끝낸다.** 한 카테고리(예: 탈모)를 완료하기 전에 다른 카테고리로 넘어가지 않는다. 순서: 탈모 → 검증된 수요 상위 카테고리 순.
- 배치 1회 = 같은 카테고리에서 큐(rewrite-queue.json) 상위 N편.
- **파일럿 승인 없이 대량 배포 금지 (유방 사고 재발 방지)**: 배치 시작 시 먼저 5편만 작성·반영 → 운영자에게 라이브 URL 5개 제시 → 운영자 승인 후에만 나머지 진행·배포. 지적이 나오면 즉시 검증기 규칙화 후 재시작.
- **사용량 절약**: 배치는 Sonnet 세션에서만. Fable/Opus는 사고 조사·시스템 개정에만. 검증·채점은 스크립트라 토큰 0.
- **라이브 육안 검수 의무 (품질 우선 원칙)**: 배치 차수마다 배포 후 Claude가 브라우저로 라이브 표본을 직접 열어 독자 시점 체크 — ① 서론이 1위 질문에 즉답하는가 ② 흐름이 사람 글처럼 매끄러운가(기계 문구·어색한 연결 0) ③ 띄어쓰기·문단 ④ 버튼·가격 표기 정상. 표준 글(아보다트 등) 대비 미달이면 통과했어도 재작성. 검증기는 하한선, 육안이 최종선.

## 파이프라인 (불가변)

```
source-data → intent-classifier → writer → verifier → reviewer → 배포
```

`writer`는 격리 서브에이전트(Read 도구만). 메인 Claude 약학 지식 차단 → AI 학습 지식 누설 구조적 방지.

## 작성 명령

```
/write-spoke {slug}
```

한 줄로 4-agent 체인 실행 후 `data/articles/{cat}-N.ts` 반영.

## 절대 원칙

1. **source-data에 없는 정량 데이터(숫자·기간·확률·연령) 0건**. AI 학습 지식 금지.
2. **slug ↔ source itemName 일치** 검증 (피나원 사고 방지).
3. **같은 ingredientGroup 5-gram overlap < 30%** (doorway 방지).
4. **모든 글 가격 H2 + 본문 "원" 3회 + 타이틀에 "최저가" 또는 "가격" 포함**.
5. **검색 의도 6분기 × 차별 앵커 8종 = 글마다 1 unique 조합**. intent-classifier 자동 결정.

## 가격 섹션·버튼 (불가변)

1. **가격 H2는 본문 중앙** — 복용법/사용법 섹션 바로 뒤. 글 끝 배치 금지.
2. **가격 본문엔 발키리 실거래 범위**(최저~최고, 인증 약국 수)를 우선 표기. 없으면 "기준가" 명시.
3. **버튼 라우팅**: barkiryProductId 있음 → 발키리 제품 페이지("발키리 약국 최저가 바로가기") / externalSearchUrl → 네이버쇼핑("네이버 최저가 바로가기") / 둘 다 없음 → 내부 `/{cat}/가격비교`("전체 가격비교 보기"). PriceCTA가 자동 처리 — 글에서는 "아래 버튼에서 확인" 식으로만 안내.
4. **타이틀·본문에 "실시간 비교" 같은 못 지키는 약속 금지.**

## 서론 (찍어내기 금지)

- "핵심부터 말하면 / 결론부터 말하면 / ~정리했어요" 등 고정 훅 재사용 금지 (검증기 B8 자동 반려).
- 서론 첫 문장은 글마다 다른 결: 상황 묘사·질문·반전·계산 제안 등 변주. 단, 150자 내 핵심 답변 원칙은 유지.

## 문체

- `~해요/~이에요/~예요`. `~합니다/~입니다` 금지. metaDescription만 문어체 허용.
- 받침 조사 정확성 (`아보다트은` ✗ → `아보다트는` ✓).
- 출처 인용: 1,000자당 식약처/품목번호/허가사항/임상시험 ≥ 1회.
- 정보 밀도: 100자당 숫자 ≥ 2.0.
- 금지 표현: `scripts/quality-config.json` `forbiddenWords` 전체 (가짜 공감 후킹 6개 포함).

## 검색 의도 6분기

| 의도 | 검색 패턴 | 카테고리 비율 |
|---|---|---|
| A 효과 | "{제품} 효과·언제부터" | 25% |
| B 부작용 | "{제품} 부작용·졸려요" | 20% |
| C 사용법 | "{제품} 복용법·1일 몇번" | 15% |
| D 가격 | "{제품} 최저가·약국가" | 25% |
| E 비교 | "{A} vs {B}·차이" | 10% |
| F 대안 | "{제품} 단종·대신" | 5% |

의도별 H2 순서·글자수: `.claude/templates/intent-{A~F}.template.md`.

## 글자수 (v3.1)

총 2,400~3,800자. **섹션당 350~600자, 300자 미만은 자동 반려(B10).** H2 질문의 답은 섹션 첫 문장에, 브리프 소스 재료는 소진.

## 작업 영역

- 수정 가능: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`, `source-data/*.json`
- 수정 금지: `app/**`, `components/**`, `lib/types.ts`, `next.config.ts`, `wrangler.toml`
- 자동 관리(gitignore): `_workspace/*` (4-agent 임시 출력)

## 품질 검증 주체 (사람 아님 — 기계가 한다)

> v3.1+ (2026-06-17): 라이브 실측으로 신설 — **human-feel 게이트**(`scripts/human-feel.js`, AI찍어내기·규정문서단조·출처부재·복제양산 차단, auto-batch Layer 2.5)와 **타이틀 감사**(`scripts/audit-titles.js`, 레거시 나열형·가격단어누락 큐). 임계값은 `quality-config.json` humanFeel/titleAudit. 진단 근거: `reports/진단-자동화개선-2026-06-17.md`.


| 단계 | 검증자 | 도구 |
|---|---|---|
| 작성 전 | 무결성 게이트 | verify-slug-integrity.js + build-write-brief.js (가짜약·미검증 소스 차단) |
| 작성 후 | 검증기 16규칙 | validate-article.js (타이틀 숫자·중복, 서론 찍어내기, 숫자 화이트리스트, 복붙, 어미 단조, 섹션 300자) |
| 작성 후 | 채점기 10지표 | score-article.js (표준 11편 대비 90% 미달 → SCORE FAIL, 재작성) |
| 푸시 시 | pre-push 훅 | 풀빌드 유발 푸시 차단 |
| 표본 | 운영자 | 배치 20편당 1~2편 육안 검수 → 지적사항은 템플릿·검증기 규칙으로 추가(기준 상향만 가능) |

작성자(Claude·어떤 모델이든)는 검증의 주체가 아니라 **대상**이다. PASS+SCORE PASS 없이는 반영 금지.

## 운영 명령

```
npm run quality                       # 8항목 전수 검증
npm run deploy:slugs {cat}/{slug}     # 부분 배포
node scripts/rebuild-source-map.js    # source-map 재생성
```

## 무인 배치 (Claude Code 헤드리스 — 공식 docs: code.claude.com/docs/en/headless)

```
node scripts/auto-batch.mjs --category 탈모 --batch 20         # 리라이트 배치
node scripts/auto-batch.mjs --repair --batch 20                # repair-list 수리 배치
node scripts/auto-batch.mjs --slugs 탈모/A,탈모/B --batch 2     # 명시 목록
node scripts/auto-batch.mjs ... --dry                          # 모의(픽스처) 테스트
```

- 글당: 브리프 게이트 → `claude -p`(Sonnet) 작성 → 검증 23규칙+채점 10지표 → FAIL 시 반려사유 포함 재작성(최대 3회) → 통과만 반영+허브 동기화+TS검사
- 3회 실패 = 에스컬레이션 큐(상위 모델/사람), 소스 불량 = 차단. 통과분 부분배포 명령 자동 출력
- 카테고리 첫 배치는 파일럿 5편에서 자동 정지 → 운영자 라이브 검수 승인 후 재실행
- 보고서: `_workspace/batch-logs/{ts}.json` / 진행 기록: `_workspace/batch-done.json`
- 실전 전제: PC에 Claude Code CLI 로그인 상태. 첫 실전은 `--batch 2`로 헤드리스 동작 확인 후 확대

폐기된 구 규칙·변경 사유·마이그레이션·SEO 디테일은 `.claude/docs/operations.md`.
