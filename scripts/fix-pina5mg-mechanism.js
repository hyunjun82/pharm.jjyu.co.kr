/**
 * 피나스테리드 5mg 기전 오류 종합 수정
 * "5α-환원효소 1형과 2형을 모두 억제" → "2형을 선택적으로 억제"
 *
 * 피나스테리드는 2형만 억제 (두타스테리드가 1형+2형 모두 억제)
 * 이전 fix-finasteride-error.js가 놓친 패턴들을 수정
 *
 * 전략:
 * 1. 피나스테리드 5mg 성분 블록(amount:"5mg" + name:"피나스테리드") 범위 검출
 * 2. 해당 블록 내에서만 수정 적용
 * 3. "두타스테리드"가 같은 라인에 있는 비교 문장은 제외 (올바른 내용)
 */

const fs = require('fs');
const content = fs.readFileSync('data/articles/탈모.ts', 'utf8');
const lines = content.split('\n');

let fixes = 0;
const fixLog = [];

// 최상위 스포크 슬러그 라인 찾기 (4칸 들여쓰기 + 키: {, CRLF 처리)
// verify-wiki-quality.js와 동일한 패턴
const slugLinePattern = /^[ ]{2,6}(?:"([^"]+)"|([가-힣\w]+))\s*:\s*\{/;
const slugRanges = [];

let curSlug = null;
let curStart = -1;

for (let i = 0; i < lines.length; i++) {
  const lineClean = lines[i].replace(/\r$/, ''); // CRLF → LF
  const m = lineClean.match(slugLinePattern);
  if (m) {
    const slug = m[1] || m[2];
    if (curSlug && curStart !== -1) {
      slugRanges.push({ slug: curSlug, start: curStart, end: i - 1 });
    }
    curSlug = slug;
    curStart = i;
  }
}
if (curSlug && curStart !== -1) {
  slugRanges.push({ slug: curSlug, start: curStart, end: lines.length - 1 });
}

// 피나스테리드5mg 블록 필터링 (ingredients에 피나스테리드+5mg 포함)
const pina5mgRanges = slugRanges.filter(range => {
  const block = lines.slice(range.start, Math.min(range.end + 1, range.start + 80)).join('\n');
  return (
    block.includes('name: "피나스테리드"') &&
    (block.includes('amount: "5mg"') || block.includes('"5mg"'))
  );
});

console.log(`피나스테리드 5mg 블록 감지: ${pina5mgRanges.length}개\n`);
for (const r of pina5mgRanges) {
  console.log(`  - ${r.slug} (L${r.start + 1}~L${r.end + 1})`);
}
console.log('');

// 수정 규칙
const REPLACEMENTS = [
  // 성분 role 필드 수정
  {
    desc: 'role: 1·2형 억제 → 2형 선택적 억제',
    from: '5α-환원효소 1·2형 억제 → DHT 생성 70~90% 감소',
    to:   '5α-환원효소 2형 선택적 억제 → DHT 생성 약 70~80% 감소',
  },
  {
    desc: 'role: 1형·2형 억제(DHT) → 2형 선택적 억제',
    from: '5α-환원효소 1형·2형 억제 (DHT 생성 차단, 전립선비대증·탈모 치료)',
    to:   '5α-환원효소 2형 선택적 억제 (DHT 생성 차단, 전립선비대증·탈모 치료)',
  },

  // 본문 content 수정 — 피나스테리드가 주어인 패턴들
  {
    desc: '피나스테리드 5mg은 5α 1형과 2형 억제 → 2형 선택적',
    from: '피나스테리드(Finasteride) 5mg은 5α-환원효소 1형과 2형을 모두 억제해',
    to:   '피나스테리드(Finasteride) 5mg은 5α-환원효소 2형을 선택적으로 억제해',
  },
  {
    desc: '피나스테리드(Finasteride) 5mg은 5α 1·2형 억제 → 2형 선택적',
    from: '피나스테리드(Finasteride) 5mg은 5α-환원효소 1·2형을 모두 억제해',
    to:   '피나스테리드(Finasteride) 5mg은 5α-환원효소 2형을 선택적으로 억제해',
  },
  {
    desc: '5α(5-alpha reductase) 1형과 2형 억제 → 2형 선택적',
    from: '5α-환원효소(5-alpha reductase) 1형과 2형을 모두 억제해',
    to:   '5α-환원효소(5-alpha reductase) 2형을 선택적으로 억제해',
  },
  // 5mg 직접 언급 패턴
  {
    desc: '5mg은 5α-환원효소 1·2형 억제 → 2형 선택적',
    from: '5mg은 5α-환원효소 1·2형을 모두 억제해',
    to:   '5mg은 5α-환원효소 2형을 선택적으로 억제해',
  },
];

// 블록 내 줄별 수정 (두타스테리드 같은 줄은 제외)
for (const range of pina5mgRanges) {
  for (let i = range.start; i <= range.end; i++) {
    const line = lines[i];

    // 두타스테리드가 같은 줄에 있는 경우 비교 문장 → 건드리지 않음
    if (line.includes('두타스테리드')) continue;

    let newLine = line;

    for (const rule of REPLACEMENTS) {
      if (newLine.includes(rule.from)) {
        newLine = newLine.split(rule.from).join(rule.to);
      }
    }

    // 추가: "5α-환원효소 1형과 2형을 모두 억제해" 패턴 (두타스테리드 없는 줄)
    if (!line.includes('두타스테리드')) {
      newLine = newLine
        .replace(/5α-환원효소 1형과 2형을 모두 억제해/g, '5α-환원효소 2형을 선택적으로 억제해')
        .replace(/5α-환원효소 1형과 2형을 억제해/g, '5α-환원효소 2형을 선택적으로 억제해')
        .replace(/5α-환원효소의 1형과 2형을 모두 억제해/g, '5α-환원효소의 2형을 선택적으로 억제해')
        .replace(/5α-환원효소의 1형과 2형을 억제해/g, '5α-환원효소의 2형을 선택적으로 억제해')
        .replace(/5α-환원효소 1·2형을 모두 억제해/g, '5α-환원효소 2형을 선택적으로 억제해');
    }

    if (newLine !== line) {
      fixLog.push({ lineNo: i + 1, slug: range.slug, before: line.trim().substring(0, 80), after: newLine.trim().substring(0, 80) });
      lines[i] = newLine;
      fixes++;
    }
  }
}

console.log(`\n수정 내역: ${fixes}줄\n`);
for (const log of fixLog) {
  console.log(`  L${log.lineNo} [${log.slug}]`);
  console.log(`    Before: ${log.before}`);
  console.log(`    After:  ${log.after}`);
  console.log('');
}

if (fixes > 0) {
  fs.writeFileSync('data/articles/탈모.ts', lines.join('\n'));
  console.log(`✅ ${fixes}줄 수정 완료`);
} else {
  console.log('수정 대상 없음 (이미 수정됐거나 패턴 없음)');
}

// 검증
console.log('\n=== 검증 ===');
const verify = fs.readFileSync('data/articles/탈모.ts', 'utf8');
const verLines = verify.split('\n');

// 피나스테리드5mg 블록에서 아직 1형 억제 남아있는지
let remaining = 0;
for (const range of pina5mgRanges) {
  for (let i = range.start; i <= range.end; i++) {
    const vl = verLines[i] || '';
    if (vl.includes('두타스테리드')) continue;
    if ((vl.includes('1형과 2형을') || vl.includes('1·2형')) && vl.includes('억제')) {
      console.log(`  ❌ L${i+1} [${range.slug}] 미수정 잔존: ${vl.trim().substring(0, 80)}`);
      remaining++;
    }
  }
}
if (remaining === 0) {
  console.log('✅ 피나스테리드 5mg 블록에 1형 억제 표현 없음!');
}

// 두타스테리드 블록은 유지됐는지 샘플 확인
const dutaSample = verLines.find(l => l.includes('두타스테리드는 5α-환원효소 1형과 2형을 모두 억제해'));
console.log(`두타스테리드 1형+2형 설명 유지: ${dutaSample ? '✅' : '⚠️ 없음 (확인 필요)'}`);
