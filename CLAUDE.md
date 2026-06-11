# pharm.jjyu.co.kr 글 생산 규칙

> v3 (2026-06-11). 마스터 템플릿 `.claude/templates/master-quality.template.md` 기준. 디테일은 `.claude/docs/operations.md`. 검증 기준은 `scripts/quality-config.json`.

## 배포 규칙 (불가변 — 푸시 전 반드시 확인)

1. **일상 배포는 부분배포만.** 글 작성·수정 후 전체 푸시 빌드(11분) 금지:
   ```
   node scripts/deploy-incremental.mjs --slugs 탈모/아보다트,탈모/프로페시아
   ```
   바뀐 글만 빌드해 1~3분 내 실사이트 반영.
2. **Cloudflare Pages "빌드 일시 중지" 상태 유지.** git push는 백업용 — push가 풀빌드를 트리거하면 안 됨.
3. **풀빌드는 템플릿/컴포넌트(`app/`, `components/`) 변경 시 1회만.** 절차: main에 merge → push → 대시보드에서 빌드 일시중지 해제 → 빌드 완료 확인 → 다시 일시중지.
4. **브랜치**: 실사이트 = `main`. 작업 브랜치에서 커밋했으면 main merge 전까지 실사이트 반영 안 됨 (프리뷰만 생성).
5. **배포 전 게이트 (순서 고정)**: ① `node scripts/build-write-brief.js {slug}`가 차단(NEEDS_REFETCH)이면 작성 금지 ② 작성 후 `node scripts/validate-article.js {slug} {draft}` PASS ③ TS 구문 검사 ④ 그 다음에만 배포.

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

## 글자수

의도별 2,000~3,500자 (기존 7,500자에서 축소, 정보 밀도 우선).

## 작업 영역

- 수정 가능: `data/articles/{카테고리}-N.ts`, `data/products/{카테고리}.ts`, `source-data/*.json`
- 수정 금지: `app/**`, `components/**`, `lib/types.ts`, `next.config.ts`, `wrangler.toml`
- 자동 관리(gitignore): `_workspace/*` (4-agent 임시 출력)

## 운영 명령

```
npm run quality                       # 8항목 전수 검증
npm run deploy:slugs {cat}/{slug}     # 부분 배포
node scripts/rebuild-source-map.js    # source-map 재생성
```

폐기된 구 규칙·변경 사유·마이그레이션·SEO 디테일은 `.claude/docs/operations.md`.
