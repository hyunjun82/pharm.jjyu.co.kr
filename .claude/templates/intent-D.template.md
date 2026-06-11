# intent-D: 가격 (Price)

검색 패턴: `{slug} 가격`, `{slug} 최저가`, `{slug} 약국가`, `{slug} 얼마`

## 글자수
총 2,200~2,600자. H2 6개.

## H2 순서 (고정)

1. **{slug} 효과·성분 핵심** (200~280자)
   - 검색자 의도(가격)에 빠른 진입 위해 효과는 1~2문장으로 간략
   - facts.efcyQesitm 핵심만

2. **{slug} 가격은 얼마인가요? (전국 최저가)** (480~580자, 가격 H2 위치 2)
   - **이 글의 핵심 섹션**. 본문 "원" 텍스트 5회 이상 권장
   - facts.priceData.min·max·storeCount·평균 모두 인용
   - sectionType: "price-table" 또는 "comparison"
   - 형식 예:
     ```
     {slug}의 전국 약국 최저가는 {min}원이에요.
     평균 가격은 약 {avg}원, 최고가는 {max}원까지 분포해요.
     전국 {storeCount}개 약국에서 판매 중이고, 약국마다 가격 차이가 큰 편이에요.
     ```

3. **{slug} 약국별 가격 차이가 나는 이유** (350~450자)
   - 약국 유형(체인/개인)·지역·매입 단가 등 일반 요인 설명
   - facts에 없는 추측은 금지. "가격은 약국마다 다를 수 있어요" 식 무난한 설명.

4. **{slug} 같은 성분 더 저렴한 대안** (400~500자, sectionType: "alternatives")
   - ingredientGroup의 다른 spoke 중 가격 더 낮은 제품
   - "{대안제품} {대안가격}원" 형식
   - 효과·부작용 동등성 명시 (성분 같으면 효과 동등)

5. **{slug} {usage}** (250~350자)
   - source.useMethodQesitm 핵심만

6. **{slug} 부작용·주의사항** (350~450자)
   - source.seQesitm + atpnQesitm 합쳐서 짧게

## 타이틀 공식 (v3 — 구 공식 폐기)

가격 숫자·파이프 나열·"약국별/실시간 비교" 약속 금지.
제품명 선두 + 의도 후킹 문장 + "가격|최저가" 단어. 패턴은 `master-quality.template.md` §1 참조.


## 필수 anchor
- `minPrice`: 최저가
- `maxPrice`: 최고가
- `storeCount`: 판매 약국 수

## 차별화 가이드

D형 글이 같은 ingredientGroup에 여러 개일 때:
- 가격대 anchor(priceTier): 고가 제품(20,000원+) vs 중가 vs 저가(10,000원-)
- 제형 anchor(form): 액제 가격 vs 폼 가격 vs 겔 가격
- 함량 anchor(dose): 3% 가격 vs 5% 가격 (단위당 가격 환산)

## heroDescription
80~150자. **첫 줄에 반드시 가격 정보**.
예: "{slug} 최저가는 {min}원, 평균은 약 {avg}원이에요. 약국별 가격 차이, 같은 성분 더 싼 대안까지 비교했어요."

## FAQ 3개
1. 가격 직접 (예: "{slug} 가장 싼 약국은 어디인가요?")
2. 가격 변동 (예: "{slug} 가격이 최근 오른 이유는?")
3. 가격 대안 (예: "{slug}보다 싼 같은 성분 제품은?")

## 본문 "원" 텍스트 출현 기준 (의무)
이 의도 글은 본문 전체에서 "원" 단어 **5회 이상** (다른 의도는 3회). verify-price.js가 자동 검증.
