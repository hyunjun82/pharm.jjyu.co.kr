---
name: write-spoke
description: pharm-jjyu 글 1개를 4-agent 파이프라인으로 작성한다. /write-spoke {slug} 한 줄로 intent-classifier → writer → verifier → reviewer 체인 실행. PASS시 data/articles에 자동 반영. FAIL시 violations 재입력해 최대 3회 재시도.
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Bash, Edit, Agent, Glob, Grep
arguments: [slug, category]
argument-hint: [slug] [category]
---

# pharm-jjyu 글 작성 4-agent 파이프라인

`/write-spoke {slug}` 한 줄로 글 1개를 작성하거나 리라이트한다.

인수:
- `$0` 또는 `$slug`: 글 slug (필수, 예: 미녹시딜)
- `$1` 또는 `$category`: 카테고리 slug (선택, 자동 추론)

## 절차

### 1. 사전 확인

```bash
# source-data 존재 확인
test -f source-data/$slug.json || { echo "ABORT: source-data/$slug.json 없음. node scripts/fetch-source.js --slug $slug 먼저 실행 필요."; exit 1; }

# _workspace 디렉토리 보장
mkdir -p _workspace
```

### 2. intent-classifier 호출

Agent 도구로 `intent-classifier` 호출:
- 입력: slug, category (있으면)
- 출력: `_workspace/{slug}-brief.json`

성공 시 brief.json Read해서 searchIntent·anchor·ingredientGroup 확인.

### 3. writer 호출

Agent 도구로 `writer` 호출:
- 입력: brief.json, 해당 intent template (`.claude/templates/intent-{X}.template.md`)
- 출력: writer 응답의 TypeScript 코드 블록

응답에서 SpokeArticle 코드 블록을 추출해 `_workspace/{slug}-draft.ts`에 저장.

### 4. verifier 호출

Agent 도구로 `verifier` 호출:
- 입력: draft.ts, brief.json
- 출력: `_workspace/{slug}-verify.json` (pass: true/false + violations)

### 5. 결과 분기

**PASS시** (`verify.pass === true`):
- Agent 도구로 `reviewer` 호출 → data/articles/{cat}-N.ts에 Edit 반영
- 결과 보고: "✅ 반영 완료: {category}-{N}.ts의 {slug} entry. dateModified={today}"
- 사용자에게 `npm run deploy:slugs {cat}/{slug}` 권장

**FAIL시**:
- violations 추출
- writer에 violations 재입력해 재작성 (단순 fix 제안 포함)
- verifier 재호출
- 최대 3회 반복

3회 모두 FAIL시:
- 사용자에게 violations 전체 보고
- `_workspace/{slug}-final-fail.json` 저장 (수동 수정 필요)
- 중단

## 호출 예시

```text
/write-spoke 미녹시딜
/write-spoke 프로페시아 탈모
/write-spoke "판콜에이"
```

## 의도 분배 안내

- 동일 ingredientGroup에서 같은 (intent×anchor) 조합 회피
- intent-classifier가 자동 결정. 사용자가 강제하고 싶으면 brief.json 수동 편집 후 writer 직접 호출

## 디버깅

각 단계 출력은 `_workspace/{slug}-{brief|draft|verify}.{json|ts}` 파일에 영구 저장.
실패 분석:
```bash
cat _workspace/$slug-verify.json | jq '.violations'
```

## 안전장치

- writer는 Read만 허용 → 직접 파일 수정 불가
- verifier가 PASS 신호 안 주면 reviewer 호출 안 함
- reviewer 외 누구도 data/articles·data/products 수정 불가 (hooks로 강제)
