# intent-E: 비교 (Comparison)

검색 패턴: `{slug} vs {slug2}`, `{slug} 차이`, `{slug} 비교`

## 글자수
총 2,800~3,500자. H2 7개. 가장 긴 의도 (비교 항목이 많음).

## H2 순서 (고정)

1. **{productA} vs {productB} 한눈에 보기** (300~400자, sectionType: "comparison")
   - 한 줄 비교표 (성분/효과/가격/부작용)
   - 양 제품의 facts.priceData 모두 인용

2. **{productA} vs {productB} 성분 차이** (400~500자)
   - facts.ingredients 양쪽 비교
   - 활성 성분 동일 여부, 함량 차이, 첨가제 차이

3. **{productA} vs {productB} 효과 차이** (400~500자)
   - facts.efcyQesitm 양쪽 비교
   - 효과 발현 기간 차이 (있으면)

4. **{productA} vs {productB} 부작용 차이** (400~500자)
   - facts.seQesitm 양쪽 비교
   - 빈도 수치 양쪽 인용 (facts에 있을 때만)

5. **{productA} vs {productB} 가격 차이** (350~450자)
   - 양쪽 priceData min·max·평균 비교
   - 단위당 가격 환산 (예: 1정당 가격)
   - "원" 텍스트 5회 이상

6. **{productA} vs {productB} 어떤 게 나에게 맞을까** (400~500자)
   - 사용자 상황별 권장 (가격 민감/효과 우선/부작용 회피 등)
   - facts 안에서만 추론. 임의 권장 금지.

7. **다른 동일 성분 제품도 비교하기** (250~350자)
   - ingredientGroup의 다른 spoke 2~3개 짧게 언급 (RelatedSpokes 자동)

## 타이틀 공식
`{productA} vs {productB} 차이 | 효과·부작용·가격 비교`

예: `프로페시아 vs 헤어그로 차이 | 효과·부작용·가격 비교`

## 필수 anchor
- `성분차이`: 활성 성분 동일/다름
- `효과차이`: 임상 또는 사용법 기반 효과 차이
- `가격차이`: 단위당 가격 비교

## 차별화 가이드

E형 글이 같은 ingredientGroup에 여러 개일 때:
- 비교 대상 쌍이 다름 (A vs B, A vs C, B vs C 등)
- 비교 축이 다름 (가격 비교 vs 부작용 비교 vs 효과 비교 중심)
- 처방여부 anchor(prescription): 전문약 vs 일반약 비교

## heroDescription
80~150자. **두 제품 명시 + 핵심 차이**.
예: "{productA}와 {productB}는 같은 {ingredient} 성분이지만 {핵심차이}가 달라요. 효과·부작용·가격을 한눈에 비교했어요."

## FAQ 3개
1. 직접 비교 (예: "{productA}와 {productB} 중 효과가 더 빠른 건?")
2. 전환 (예: "{productA}에서 {productB}로 바꿔도 되나요?")
3. 가격·접근성 (예: "{productA}와 {productB} 처방받는 곳이 다른가요?")

## 비교 글의 특수 규칙

- 한쪽 제품 우월성을 단정적으로 쓰지 말 것 ("{A}가 더 좋아요" ✗)
- "{A}는 {특성1}이 강하고, {B}는 {특성2}가 강해요" 식 균형 서술 ✓
- 광고성 표현 금지 (식약처 광고 규제 준수)
