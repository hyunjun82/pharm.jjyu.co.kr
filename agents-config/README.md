# agents-config — Claude Managed Agents 배포 설정

`pharm.jjyu.co.kr` 색인율 1.3% 위기 대응 자동화. 7,617개 글 리라이트를
Anthropic [Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview)
로 양산하기 위한 YAML 정의 묶음.

> **로컬 개발용 vs 클라우드 양산용**
> - `.claude/agents/*.md` = Claude Code 서브에이전트 (CLI 로컬 호출, 시범·디버그)
> - `agents-config/*.yaml` = Managed Agents (클라우드 양산, 야간 배치)

---

## 파일 구성

```
agents-config/
├── README.md                    이 문서
├── 00-environment.yaml          컨테이너 환경 (Node.js + 프로젝트 마운트)
├── 01-source-fetcher.yaml       e약은요/식품안전나라 source-data 수집
├── 02-intent-analyst.yaml       검색의도 분기 결정 (doorway 방지 핵심)
├── 03-fact-miner.yaml           고유 데이터 포인트 후보 풀 추출
├── 04-writer.yaml               의도 템플릿 기반 본문 작성
├── 05-verifier.yaml             6 Layer 병렬 검증
├── 06-coordinator.yaml          pharm-article-lead (sub-agent ID 주입 필요)
└── 07-dream-template.yaml       Dreams 야간 메모리 큐레이션 작업
```

---

## 사전 준비

### 베타 헤더
모든 요청에 필요:
```
anthropic-beta: managed-agents-2026-04-01
```
Dreams 추가:
```
anthropic-beta: managed-agents-2026-04-01,dreaming-2026-04-21
```

SDK는 자동 설정. CLI(`ant`)도 자동.

### Research Preview Access
다음 기능은 신청 후 사용 가능:
- **Multi-agent coordinator** (06-coordinator)
- **Outcomes Loop** (06-coordinator의 outcomes 필드)
- **Dreams** (07-dream-template)

신청: https://claude.com/form/claude-managed-agents

### 환경 변수
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# 배포 후 sub-agent ID들이 채워짐
export SOURCE_FETCHER_ID=""
export INTENT_ANALYST_ID=""
export FACT_MINER_ID=""
export WRITER_ID=""
export VERIFIER_ID=""
export COORDINATOR_ID=""
export ENVIRONMENT_ID=""
export WRITER_MEMORY_STORE_ID=""
```

---

## 배포 순서 (한 번만)

### 1. 환경 생성

```bash
ENVIRONMENT_ID=$(ant beta:environments create --transform id < 00-environment.yaml)
echo "ENV: $ENVIRONMENT_ID"
```

### 2. Sub-agents 먼저 생성 (coordinator가 ID 참조)

```bash
SOURCE_FETCHER_ID=$(ant beta:agents create --transform id < 01-source-fetcher.yaml)
INTENT_ANALYST_ID=$(ant beta:agents create --transform id < 02-intent-analyst.yaml)
FACT_MINER_ID=$(ant beta:agents create --transform id < 03-fact-miner.yaml)
WRITER_ID=$(ant beta:agents create --transform id < 04-writer.yaml)
VERIFIER_ID=$(ant beta:agents create --transform id < 05-verifier.yaml)

echo "SOURCE: $SOURCE_FETCHER_ID"
echo "INTENT: $INTENT_ANALYST_ID"
echo "FACT:   $FACT_MINER_ID"
echo "WRITER: $WRITER_ID"
echo "VERIFY: $VERIFIER_ID"
```

### 3. Writer memory store 생성 (Dreams용)

```bash
WRITER_MEMORY_STORE_ID=$(ant beta:memory_stores create --transform id \
  --name "pharm-writer-memory")
```

### 4. Coordinator 생성 (env 변수 주입)

```bash
envsubst < 06-coordinator.yaml | ant beta:agents create
COORDINATOR_ID=$(ant beta:agents list --name pharm-article-lead --transform id | head -1)
```

---

## 사용

### 단건 작성 / 리라이트
```bash
ant beta:sessions create \
  --agent "$COORDINATOR_ID" \
  --environment-id "$ENVIRONMENT_ID" \
  --resources "[{\"type\":\"memory_store\",\"memory_store_id\":\"$WRITER_MEMORY_STORE_ID\"}]" \
  --input '{"slug":"아보다트","mode":"new"}'
```

### 카테고리 일괄 (예: 유산균 1029개)
별도 큐 스크립트 필요. Rate limit 300 create/min이라 한 번에 200개 정도가 안전. `_workspace/queue.json`에 slug 리스트 저장 → 워커가 컨슘.

### Dreams (주 1회 야간)
```bash
# 일요일 03:00 cron
ant beta:dreams create < 07-dream-template.yaml
# review 후 새 memory store 채택 여부 결정
```

---

## 비용 모니터링

- Managed Agents create: 300 req/min, read: 600 req/min
- Dreams: 표준 토큰 요금. 100세션 input 시 분~수십분 소요.
- coordinator 1회 = sub-agent 5종 호출 + writer 재시도 평균 1.3회 ≈ **1글 약 80k tokens**
- 7,617글 = 약 6억 토큰. opus-4-7 기준 비용 견적 필수 (먼저 100건 샘플 측정 권장)

---

## 폐기 / 재배포

```bash
# agent 정의만 archive (세션은 유지)
ant beta:agents archive --agent-id "$WRITER_ID"

# 새 정의로 재배포
WRITER_ID=$(ant beta:agents create --transform id < 04-writer.yaml)
# coordinator의 roster 업데이트 필요
```

---

## 트러블슈팅

| 증상 | 원인 |
|---|---|
| `multiagent.agents` 깊이>1 무시됨 | 공식 제약. sub-agent가 sub-sub 못 부름. |
| 25 thread 초과 | coordinator가 같은 agent 26개+ 동시 호출 시. queue로 throttle. |
| `input_memory_store_unavailable` | Dream 도중 input store가 archive/delete됨. |
| writer 재시도 3회 fail | source-data 또는 카테고리 의도 풀 고갈. `_workspace/_failed/{slug}.md` 확인. |
