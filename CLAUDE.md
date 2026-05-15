# pharm.jjyu.co.kr 글 생산 규칙

> v2 재설계 (2026-05-15). 디테일은 `.claude/docs/operations.md`. 검증 기준은 `scripts/quality-config.json`.

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
