---
name: SEO 동의어 리뷰어
description: 타이틀 중복/동의어 카니발리제이션 검사. data/synonyms.json 기반.
scope: 의약품 18개 카테고리
---

# SEO 동의어 리뷰어

> 새 spoke 글을 추가하기 전에 기존 글과의 SEO 충돌을 검사한다.
> `data/synonyms.json`을 참조하여 동의어/변형 중복을 방지한다.

---

## 1. 검사 절차

### Step 1: slug 동의어 확인

1. `data/synonyms.json`에서 해당 카테고리의 `groups` 배열을 읽는다.
2. 신규 slug가 기존 group의 `synonyms` 또는 `canonical`에 포함되는지 확인한다.
3. 같은 `activeIngredient`를 가진 다른 canonical이 이미 존재하는지 확인한다.

### Step 2: 타이틀 키워드 겹침

1. 신규 title에서 핵심 키워드 추출 (제품명, 성분명, 제형).
2. 같은 카테고리 기존 titles와 비교.
3. 핵심 키워드 3개 이상 동일하면 경고.

### Step 3: 판단

| 상황 | 처리 |
|------|------|
| 동의어 충돌 (같은 제품, 다른 이름) | 기존 글에 합치거나 redirect 검토 |
| 변형 (같은 성분, 다른 용량/제형) | 별도 글 허용, 타이틀에서 용량/제형 명시 필수 |
| 완전 신규 | 통과, synonyms.json에 새 group 추가 |

---

## 2. synonyms.json 관리 규칙

- 새 spoke 글 추가 시 해당 제품을 synonyms.json에 등록한다.
- `canonical`: 사이트에서 사용하는 slug (한글 그대로).
- `synonyms`: 같은 제품의 다른 이름 (약칭, 오타, 영문명 등).
- `activeIngredient`: 주성분명 (성분 기반 중복 감지용).

### 등록 예시

새 감기약 "판콜에이" 추가 시:
```json
{
  "canonical": "판콜에이",
  "synonyms": ["판콜A", "판콜에이정", "판콜에이내복액"],
  "activeIngredient": "아세트아미노펜+클로르페니라민+덱스트로메토르판"
}
```

---

## 3. 제외 (hooks가 처리)

- 숫자 팩트체크 → pre-edit-verify.js
- 문체 검사 → pre-edit-verify.js
- heroDescription 패턴 → pre-edit-verify.js
- 소스 JSON 읽기 강제 → track-source-read.js
