---
description: 키워드 하나로 글 작성 (신규·리라이트 공통) — /write {키워드}
argument-hint: "{키워드 또는 카테고리/슬러그}"
---

키워드: $ARGUMENTS

`.claude/templates/article.md`를 먼저 읽고 그대로 따른다. 아래 순서를 건너뛰지 않는다.

1. **대상 찾기**
   - `ls public/data/*/` 와 `source-data/source-map.json` 에서 키워드와 같은 슬러그를 찾는다. 있으면 리라이트, 없으면 신규.
   - `public/data` 가 없으면 먼저 `node scripts/generate-article-json.mjs` (이 스크립트가 `public/sitemap.xml` 을 덮어쓰므로 끝나면 `git checkout public/sitemap.xml`).
   - 신규라면 카테고리는 식약처 원문의 효능(efcyQesitm)으로 정한다. 애매하면 멈추고 운영자에게 묻는다.
2. **근거 확인**: `source-data/{슬러그}.json`(식약처 원문)을 읽는다. 없으면 **작성하지 말고 멈춰서** "근거 파일 없음"이라고 보고한다. 제품명이 원문 itemName 과 다르면 멈춘다.
3. **실제 연관검색어 (필수)**: `node scripts/intent-harvest.mjs "{키워드}" --slug {슬러그}` → `_workspace/intent/{슬러그}.json`. 타이틀은 여기 있는 연관검색어로만 만든다(검사기 R10). 이미 `_workspace/intent/{슬러그}.json` 이 있으면 그대로 쓴다. 수집이 안 되면(네트워크 차단 등) **작성하지 말고 멈춰서** "연관검색어 수집 실패"라고 보고한다.
4. **작성**: 템플릿 §6 형식으로 `_workspace/drafts/{슬러그}.json` 저장. 숫자는 원문에 있는 것만, 계산한 숫자는 `calc` 에 식으로.
5. **검사**: `node scripts/check-article.js {카테고리}/{슬러그} _workspace/drafts/{슬러그}.json` — FAIL 이면 사유대로 고쳐 다시. 3번 안에 PASS 못 하면 멈추고 사유를 보고.
6. **저장**: `node scripts/save-article.js {카테고리}/{슬러그} _workspace/drafts/{슬러그}.json`
7. **보고**: 타이틀·서론·소제목과 PASS 결과를 보여주고 배포 여부를 묻는다. 운영자가 승인하면
   `node scripts/deploy-incremental.mjs --slugs {카테고리}/{슬러그}` 로 부분배포 → 라이브 URL 을 열어 확인까지 해야 완료.
