# intent-A: 효과 (Effect)

검색 패턴: `{slug} 효과`, `{slug} 언제부터`, `{slug} 후기`

## 글자수 (v3.1)

총 2,400~3,800자. **섹션당 350~600자 — 300자 미만은 검증기(B10) 자동 반려.**
H2 질문의 답은 섹션 첫 문장에. 브리프 소스의 관련 재료는 전부 소진.


## H2 순서 (고정)

1. **{slug} 효과는 무엇인가요?** (250~350자)
   - 핵심 효과 1줄. source.efcyQesitm 인용.
   - 작용 원리는 facts.ingredients에 있는 성분명·기전만.

2. **{slug} 효과는 언제부터 나타나나요?** (450~550자, sectionType: "timeline" 권장)
   - 기간 명시 (예: 1주차 / 1개월 / 3개월 / 6개월)
   - facts에 시간 데이터 있을 때만. 없으면 source.useMethodQesitm에서 추출.

3. **{slug} 효과를 보려면 어떻게 써야 하나요?** (350~450자)
   - source.useMethodQesitm의 핵심 단계 3~5개
   - 효과를 높이는 사용 팁 (facts.atpnQesitm에서)

4. **{slug} 가격은 얼마인가요?** (200~300자, 가격 H2 위치 4)
   - facts.priceData.min~max + storeCount
   - "원" 텍스트 3회 이상
   - 예: "약국 판매가는 {min}원~{max}원이에요. 전국 {storeCount}개 약국 평균은 약 {avg}원."

5. **{slug} 부작용은 어떤 게 있나요?** (350~450자)
   - source.seQesitm에서 흔한 부작용 3~5개
   - 빈도 수치 facts에 있을 때만

6. **{slug} 주의사항·금기는 무엇인가요?** (300~400자)
   - source.atpnQesitm·atpnWarnQesitm에서

7. **{slug}와 같은 성분 다른 제품** (200~300자)
   - ingredientGroup의 다른 spoke 2~3개 내부링크 (RelatedSpokes로 자동)
   - 본문에서는 차이점만 짧게

## 타이틀 공식 (v3 — 구 공식 폐기)

가격 숫자·파이프 나열·"약국별/실시간 비교" 약속 금지.
제품명 선두 + 의도 후킹 문장 + "가격|최저가" 단어. 패턴은 `master-quality.template.md` §1 참조.


## 필수 anchor

- `timeframe`: 효과 발현 기간 (1주/1개월/3개월/6개월 등)
- `효과지표`: 측정 가능한 지표 (모발 밀도/통증 점수/발열 일수 등)

## 차별화 가이드 (같은 성분 다른 제품과 구별)

A형 글이 같은 ingredientGroup에 여러 개일 때:
- 제형 anchor(form): 액제 vs 폼 vs 겔 → 효과 발현 속도 차이 강조
- 함량 anchor(dose): 3% vs 5% → 효과 강도·부작용 트레이드오프
- 연령 anchor(age): 성인 vs 노년 → 효과 발현 기간 차이
- 성별 anchor(gender): 여성 vs 남성 → 효과 패턴 차이

## heroDescription
80~150자. 첫 줄에 핵심 답 (효과 발현 기간 + 효과 지표).
예: "{slug}의 효과는 보통 {timeframe} 이후에 나타나요. {효과지표} 기준으로 분석한 효과 패턴과 가격을 정리했어요."

## FAQ 3개
1. 효과 관련 (예: "{slug} 효과가 없으면 언제 끊어야 하나요?")
2. 실패 시나리오 (예: "{slug} 1개월 써도 효과 없으면?")
3. 가격 또는 대안 (예: "{slug} 효과 대비 가격이 부담스러우면?")
