# pharm.jjyu.co.kr 운영 규칙

> v4 (2026-10-20). 글쓰기 시스템을 새로 시작했다. 이전 시스템(4-agent 체인·검증기 26규칙·채점기·judge·의도 6분기)은 폐기 — 이 파일과 아래 3개 파일만 기준이다.

## 원칙 0: 추측 금지
- 모든 판단·보고에는 실행 결과·파일 경로 같은 근거가 있어야 한다. 근거가 없으면 "모른다"고 말하고 확인부터 한다.
- 글의 사실·숫자는 식약처 원문(`source-data/{슬러그}.json`)에 있는 것만. AI가 아는 지식으로 쓰지 않는다.
- 규칙·검사기를 바꾸면 `node scripts/check-article.js --calibrate` 로 기준 글이 통과하는지 바로 확인한다.

## 글쓰기 (신규·리라이트 공통)

```
/write {키워드}
```

| 파일 | 역할 |
|---|---|
| `.claude/commands/write.md` | 키워드 → 근거 확인 → 실제 검색어 → 작성 → 검사 → 저장 → 배포 승인 요청 |
| `.claude/templates/article.md` | 글 기준 (타이틀·서론 3유형·소제목·본문·가격 섹션) |
| `scripts/check-article.js` | 유일한 검사기 R1~R9. FAIL이면 고쳐서 다시 |
| `scripts/save-article.js` | `data/articles` 에 저장 (리라이트=교체, 신규=추가) |

글의 핵심(운영자 확정): **타이틀이 약속한 질문 = 소제목 = 각 본문이 그 궁금증을 해결.** 글자수는 목표가 아니다. 약국 판매가는 단정하지 않는다. 서론·본문 모두 ~해요체.
기준 글: `탈모/판시딜액3`.

## 배포 규칙 (바꾸지 않는다)
1. **일상 배포는 부분배포만**: `node scripts/deploy-incremental.mjs --slugs 탈모/판시딜액3`. 배포 전 `check-article` 재검사와 "저장된 글 = 검사한 원고" 대조가 자동으로 돈다.
   부분배포는 `_full-out/` 전체 스냅샷에 병합 후 통째로 배포한다(스크립트가 처리, 스냅샷 없으면 차단). 부분 out/만 올리면 나머지 페이지가 전부 404가 된다(2026-06-13 사고).
   스냅샷 최초 생성·갱신: `node scripts/deploy-incremental.mjs --full` (풀빌드, 약 11분).
2. **Cloudflare Pages "빌드 일시 중지" 유지.** git push는 백업용.
3. **풀빌드는 `app/`·`components/` 변경 시에만 1회**: main merge → push → 대시보드에서 일시중지 해제 → 빌드 확인 → 다시 일시중지.
4. 실사이트 = `main`. 작업 브랜치 커밋은 merge 전까지 반영되지 않는다.
5. **완료 = 라이브 URL에서 새 글 확인까지.** 저장·검사 통과만으로는 완료가 아니다.
6. 한 산출물의 생성 주인은 하나: `public/sitemap.xml` 은 `scripts/generate-sitemap.js` 가 주인. (`generate-article-json.mjs` 도 덮어쓰므로 로컬에서 돌린 뒤엔 `git checkout public/sitemap.xml`)

## 작업 영역
- 글: `data/articles/`, 제품: `data/products/`, 근거: `source-data/`
- `app/**`, `components/**`, `lib/types.ts`, `next.config.ts`, `wrangler.toml` 은 운영자 승인 없이 수정하지 않는다 (모든 글에 영향 + 풀빌드).
- `_workspace/` 는 임시 작업 폴더(git 제외): `drafts/` 원고, `intent/` 실제 검색어.

## 알려진 문제 (2026-10-20 실측, 미해결)
- **네이버 색인 0**: 서치어드바이저 사이트 진단 = 색인 0 / 수집제한 1(리다이렉트). 글 품질 이전에 수집이 막혀 있다. 원인 미확정 — 서치어드바이저 "웹 페이지 최적화" 결과 필요.
- 사이트맵에 존재하지 않는 페이지 32개(진통제/마가렉스 등) 포함.
- 유산균: `page.tsx` 는 noindex 해제(8/1), `generate-sitemap.js` 는 여전히 제외 — 불일치.
- 제품 카드 이미지 경로(`/images/...`)가 저장소에 없음. 제품 카드 "YYYY.MM.DD 기준" 날짜는 실제 가격 확인일이 아니라 빌드 날짜.
- 화면 배치 변경(제품 카드를 목차 위로)은 `page.tsx` 수정 필요 — 운영자 승인 대기.
