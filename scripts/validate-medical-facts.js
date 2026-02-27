/**
 * 의학적 사실 패턴 검증 스크립트
 * 알려진 의약품 오류 패턴을 전수 검색합니다
 *
 * 검증 항목:
 * 1. 피나스테리드/두타스테리드 기전 (5α-환원효소 선택성)
 * 2. 항히스타민제 1세대/2세대 구분
 * 3. NSAID COX 선택성 (이부프로펜/나프록센 vs 셀레콕시브)
 * 4. 진해제/거담제/교감신경제 혼동
 * 5. 미녹시딜 외용/경구 혼동
 * 6. 완하제 분류
 * 7. 항진균제 기전 혼동
 *
 * 사용법: node scripts/validate-medical-facts.js
 */

const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.resolve(__dirname, '../data/articles');
const CATEGORIES = [
  '연고','감기','진통제','무좀','탈모','설사','소화제','안약',
  '구강','파스','영양제','여성건강','외상소독','두드러기','구충제','변비','알레르기','제산제'
];

const errors = [];
const warns = [];

function flag(type, cat, slug, context, msg) {
  const item = { cat, slug, context: (context || '').trim().substring(0, 120), msg };
  if (type === 'error') errors.push(item);
  else warns.push(item);
}

/**
 * 의학적 사실 규칙 목록
 * - pattern: 검색할 정규식
 * - type: 'error' | 'warn'
 * - msg: 표시할 메시지
 * - categories: 적용 카테고리 (없으면 전체)
 * - exclude: 이 패턴이 함께 있으면 skip (올바른 문맥)
 */
const RULES = [

  // ===== 탈모 — 5α-환원효소 기전 =====
  // NOTE: 두타스테리드 글의 비교 문장 "피나스테리드는 2형만, 두타스테리드는 1형+2형" 같은
  //       올바른 비교 문장은 false positive 방지를 위해 패턴을 좁게 유지
  {
    name: '피나스테리드가 직접 주어로 1형+2형 억제한다는 표현 (25자 이내)',
    // "피나스테리드" + 25자 이내 + "1형과 2형" + "모두/동시" + "억제"
    // 비교 문장은 50자 이상이므로 25자 제한으로 false positive 방지
    pattern: /피나스테리드[^。.\n]{0,25}1형과\s*2형[^。.\n]{0,15}(모두|동시)[^。.\n]{0,10}억제/,
    type: 'error',
    msg: '피나스테리드는 5α-환원효소 "2형만" 선택적 억제 — "1형과 2형" 표현 오류',
    categories: ['탈모'],
  },
  {
    name: '두타스테리드 2형만 선택적 오류 (40자 이내)',
    // 두타스테리드가 주어로서 2형만 억제한다고 직접 주장하는 경우
    // "피나스테리드" 없이 40자 이내에 "2형만 억제"가 나오면 오류
    pattern: /두타스테리드[^피나스테리드。.\n]{0,40}2형\s*선택적\s*억제/,
    type: 'error',
    msg: '두타스테리드는 1형+2형 모두 억제 — "2형 선택적 억제"는 피나스테리드 표현',
    categories: ['탈모'],
  },

  // ===== 항히스타민제 세대 오류 =====
  {
    name: '세티리진 1세대 오류',
    pattern: /세티리진[^。.\n]{0,40}1세대/,
    // "세티리진은 1세대인 클로르페니라민보다 좋아요" 같은 비교 문장 제외
    // → 1세대 약명(클로르페니라민/디펜히드라민/히드록시진)이나 "보다" 가 근처에 있으면 비교 문장
    exclude: /(클로르페니라민|디펜히드라민|디펜하이드라민|트리프롤리딘|히드록시진|보다)/,
    type: 'error',
    msg: '세티리진은 2세대 항히스타민제 (비진정성)',
    categories: ['감기', '두드러기', '알레르기'],
  },
  {
    name: '로라타딘 1세대 오류',
    pattern: /로라타딘[^。.]{0,40}1세대/,
    type: 'error',
    msg: '로라타딘은 2세대 항히스타민제',
    categories: ['감기', '두드러기', '알레르기'],
  },
  {
    name: '펙소페나딘 1세대 오류',
    pattern: /펙소페나딘[^。.\n]{0,40}1세대/,
    // "펙소페나딘은 테르페나딘(1세대)에서 유래" 같은 역사적 설명이나 비교 문장 제외
    exclude: /(테르페나딘|클로르페니라민|디펜히드라민|디펜하이드라민|트리프롤리딘|보다)/,
    type: 'error',
    msg: '펙소페나딘은 2세대 항히스타민제 (가장 비진정성)',
    categories: ['감기', '두드러기', '알레르기'],
  },
  {
    name: '레보세티리진 1세대 오류',
    pattern: /레보세티리진[^。.]{0,40}1세대/,
    type: 'error',
    msg: '레보세티리진은 2세대 항히스타민제 (세티리진 광학이성질체)',
    categories: ['두드러기', '알레르기'],
  },
  {
    name: '빌라스틴 1세대 오류',
    pattern: /빌라스틴[^。.]{0,40}1세대/,
    type: 'error',
    msg: '빌라스틴은 2세대 항히스타민제',
    categories: ['두드러기', '알레르기'],
  },
  {
    name: '클로르페니라민 2세대 오류',
    pattern: /클로르페니라민[^。.]{0,40}2세대/,
    type: 'error',
    msg: '클로르페니라민은 1세대 항히스타민제 (졸음 유발)',
    categories: ['감기', '알레르기'],
  },
  {
    name: '디펜히드라민 2세대 오류',
    pattern: /디펜히드라민[^。.]{0,40}2세대/,
    type: 'error',
    msg: '디펜히드라민은 1세대 항히스타민제',
    categories: ['감기', '알레르기'],
  },
  {
    name: '트리프롤리딘 2세대 오류',
    pattern: /트리프롤리딘[^。.]{0,40}2세대/,
    type: 'error',
    msg: '트리프롤리딘은 1세대 항히스타민제 (콘택600 성분)',
    categories: ['감기'],
  },

  // ===== NSAID COX 선택성 =====
  {
    name: '이부프로펜 COX-2 선택적 억제 오류',
    pattern: /이부프로펜[^。.]{0,60}COX-2\s*선택(적)?/,
    type: 'error',
    msg: '이부프로펜은 COX-1/2 비선택적 억제 — COX-2 선택적 억제는 셀레콕시브',
    categories: ['진통제', '감기', '파스'],
  },
  {
    name: '나프록센 COX-2 선택적 억제 오류',
    pattern: /나프록센[^。.]{0,60}COX-2\s*선택(적)?/,
    type: 'error',
    msg: '나프록센은 COX-1/2 비선택적 NSAID',
    categories: ['진통제'],
  },
  {
    name: '케토프로펜 COX-2 선택적 억제 오류',
    pattern: /케토프로펜[^。.]{0,60}COX-2\s*선택(적)?/,
    type: 'error',
    msg: '케토프로펜은 COX-1/2 비선택적 NSAID',
    categories: ['파스', '진통제'],
  },
  {
    name: '디클로페낙 COX-2 선택적 억제 오류',
    pattern: /디클로페낙[^。.]{0,60}COX-2\s*선택(적)?/,
    type: 'warn',
    msg: '디클로페낙은 COX-2 상대적 우선성 있지만 "선택적"이라 하면 오해 소지 — 비선택적 NSAID로 분류',
    categories: ['파스', '진통제'],
  },
  {
    name: '아스피린 COX-2 선택적 억제 오류',
    pattern: /아스피린[^。.]{0,60}COX-2\s*선택(적)?/,
    type: 'error',
    msg: '아스피린은 COX-1/2 비가역적 억제 (저용량 아스피린 = COX-1 혈소판 억제)',
    categories: ['진통제'],
  },

  // ===== 약물 분류 혼동 =====
  {
    name: '덱스트로메토르판 항생제 오류',
    pattern: /덱스트로메토르판[^。.]{0,40}항생제/,
    type: 'error',
    msg: '덱스트로메토르판은 진해제(기침 억제제) — 항생제가 아니에요',
    categories: ['감기'],
  },
  {
    name: '슈도에페드린 항히스타민 오류',
    pattern: /슈도에페드린[^。.\n]{0,60}항히스타민/,
    // 대조 문장 제외: "달라요", "아니에요"
    // 복합제 성분 열거 제외: 1세대 항히스타민 약명이 같은 문장에 있으면 별도 성분으로 나열된 것
    exclude: /(달라|다르|아니라|아닌|과는|와는|대조|별도|클로르페니라민|디펜히드라민|디펜하이드라민|트리프롤리딘)/,
    type: 'error',
    msg: '슈도에페드린은 교감신경 자극제(비충혈 완화제) — 항히스타민제가 아니에요',
    categories: ['감기'],
  },
  {
    name: '페닐에프린 항히스타민 오류',
    pattern: /페닐에프린[^。.\n]{0,60}항히스타민/,
    // 대조 문장 제외: "달라요", "아니에요"
    // 복합제 성분 열거 제외: 1세대 항히스타민 약명이 같은 문장에 있으면 별도 성분으로 나열된 것
    exclude: /(달라|다르|아니라|아닌|과는|와는|대조|별도|클로르페니라민|디펜히드라민|디펜하이드라민|트리프롤리딘)/,
    type: 'error',
    msg: '페닐에프린은 알파 교감신경 자극제(비충혈 완화제) — 항히스타민제가 아니에요',
    categories: ['감기'],
  },
  {
    name: '구아이페네신 진해제 오류',
    pattern: /구아이페네신[^。.\n]{0,60}진해(제|작용|효과)/,
    // "구아이페네신은 거담제로 진해제와는 달라요" 같은 대조 문장 제외
    exclude: /(달라|다르|아니라|아닌|과는|와는|대조|별도)/,
    type: 'error',
    msg: '구아이페네신은 거담제(가래 제거) — 진해제(기침 억제)가 아니에요',
    categories: ['감기'],
  },

  // ===== 미녹시딜 혼동 =====
  {
    name: '미녹시딜 외용액을 먹으라는 위험한 오류',
    // 외용액을 실제로 먹으라고 지시하는 경우만 (경구 미녹시딜정 기사/비교 문장 제외)
    pattern: /미녹시딜[^。.\n]{0,30}(경구|복용|먹는)/,
    // 경구 미녹시딜정 기사, 원래 경구용 개발 설명, 외용/도포 구분 문장, 다른 약과 병용 설명, 금지 경고 등 제외
    exclude: /(미녹시딜정|경구\s*복용법|외용|도포|바르|원래|개발|고혈압|병용|피나스테리드|금지)/,
    type: 'warn',
    msg: '미녹시딜 외용액은 두피에 바르는 약 — 경구 복용 지시 여부 확인 필요',
    categories: ['탈모'],
  },

  // ===== 완하제 분류 =====
  {
    name: '비사코딜 삼투성 완하제 오류',
    pattern: /비사코딜[^。.]{0,50}삼투성/,
    type: 'error',
    msg: '비사코딜은 자극성 완하제 (Dulcolax 주성분) — 삼투성 완하제 아니에요',
    categories: ['변비'],
  },
  {
    name: '락툴로스 자극성 완하제 오류',
    pattern: /락툴로스[^。.]{0,50}자극성/,
    type: 'error',
    msg: '락툴로스는 삼투성 완하제 — 자극성 완하제가 아니에요',
    categories: ['변비'],
  },
  {
    name: '마그네슘 자극성 완하제 오류',
    pattern: /산화마그네슘[^。.]{0,60}자극성/,
    type: 'error',
    msg: '산화마그네슘은 삼투성 완하제 — 자극성 완하제가 아니에요',
    categories: ['변비'],
  },

  // ===== 항진균제 기전 =====
  {
    name: '테르비나핀 아졸계 오류',
    pattern: /테르비나핀[^。.]{0,50}(아졸|azole)/i,
    type: 'error',
    msg: '테르비나핀은 알릴아민계 (에르고스테롤 합성 억제 경로 다름) — 아졸계가 아니에요',
    categories: ['무좀'],
  },
  {
    name: '클로트리마졸 알릴아민계 오류',
    pattern: /클로트리마졸[^。.]{0,50}알릴아민/,
    type: 'error',
    msg: '클로트리마졸은 이미다졸계 아졸 항진균제 — 알릴아민계 아니에요',
    categories: ['무좀'],
  },

  // ===== PPI vs H2 차단제 혼동 =====
  {
    name: '오메프라졸 H2 차단제 오류',
    pattern: /오메프라졸[^。.]{0,60}H2\s*(수용체|차단|억제)/,
    type: 'error',
    msg: '오메프라졸은 PPI(프로톤펌프억제제) — H2 수용체 차단제가 아니에요',
    categories: ['소화제', '제산제'],
  },
  {
    name: '에소메프라졸 H2 차단제 오류',
    pattern: /에소메프라졸[^。.]{0,60}H2\s*(수용체|차단|억제)/,
    type: 'error',
    msg: '에소메프라졸은 PPI — H2 차단제가 아니에요',
    categories: ['소화제', '제산제'],
  },
  {
    name: '파모티딘 PPI 오류',
    pattern: /파모티딘[^。.]{0,60}(PPI|프로톤\s*펌프)/,
    type: 'error',
    msg: '파모티딘은 H2 수용체 차단제 — PPI가 아니에요',
    categories: ['소화제', '제산제'],
  },
  {
    name: '라니티딘 PPI 오류',
    pattern: /라니티딘[^。.]{0,60}(PPI|프로톤\s*펌프)/,
    type: 'error',
    msg: '라니티딘은 H2 수용체 차단제 — PPI가 아니에요',
    categories: ['소화제', '제산제'],
  },

  // ===== 아세트아미노펜 최대용량 =====
  {
    name: '아세트아미노펜 하루 최대용량 오류',
    pattern: /아세트아미노펜[^。.]{0,60}(하루|1일)\s*최대?\s*(3[,.]?000mg|3g)[^가-힣]{0,30}(성인|정상)/,
    type: 'warn',
    msg: '아세트아미노펜 성인 최대용량은 4,000mg/일 (고령자·간질환 3,000mg) — 표현 맥락 확인 필요',
    categories: ['진통제', '감기'],
  },

  // ===== 아스피린 관련 =====
  {
    name: '아스피린 가역적 억제 오류',
    pattern: /아스피린[^。.]{0,60}가역적\s*억제/,
    type: 'error',
    msg: '아스피린은 COX-1/2 비가역적(irreversible) 억제 — 이부프로펜 등이 가역적 억제',
    categories: ['진통제'],
  },

  // ===== 덱스메틸페니데이트/메틸페니데이트 (영양제에서 언급 시) =====
  {
    name: '센나 삼투성 완하제 오류',
    pattern: /센나[^。.]{0,50}삼투성/,
    type: 'error',
    msg: '센나(Senna)는 자극성 완하제 — 삼투성 아니에요',
    categories: ['변비'],
  },

];

// 스포크 블록 분리 (verify-wiki-quality.js 로직 동일)
function splitSpokeBlocks(content) {
  const spokesStart = content.indexOf('export const spokes');
  if (spokesStart === -1) return [];
  const afterExport = content.substring(spokesStart);
  const firstBrace = afterExport.indexOf('{');
  const spokesBody = afterExport.substring(firstBrace + 1);
  const keyPattern = /^[ ]{2,6}(?:"([^"]+)"|([가-힣\w]+))\s*:\s*\{/gm;
  const keys = [...spokesBody.matchAll(keyPattern)];
  const blocks = [];
  for (let i = 0; i < keys.length; i++) {
    const slug = keys[i][1] || keys[i][2];
    const start = keys[i].index;
    const end = i < keys.length - 1 ? keys[i + 1].index : spokesBody.length;
    blocks.push({ slug, raw: spokesBody.substring(start, end) });
  }
  return blocks;
}

function checkBlock(cat, slug, raw) {
  for (const rule of RULES) {
    if (rule.categories && !rule.categories.includes(cat)) continue;
    const match = raw.match(rule.pattern);
    if (match) {
      // exclude 패턴이 있으면 매치 주변 100자 검사 후 false positive는 skip
      if (rule.exclude) {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(raw.length, match.index + match[0].length + 80);
        const ctx = raw.substring(start, end);
        if (rule.exclude.test(ctx)) continue;
      }
      flag(rule.type, cat, slug, match[0], rule.msg);
    }
  }
}

function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   의학적 사실 패턴 검증 — 전체 카테고리     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  let total = 0;
  const catStats = [];

  for (const cat of CATEGORIES) {
    const fp = path.join(ARTICLES_DIR, `${cat}.ts`);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');
    const blocks = splitSpokeBlocks(content);
    total += blocks.length;
    const before = errors.length + warns.length;

    for (const { slug, raw } of blocks) {
      checkBlock(cat, slug, raw);
    }

    const after = errors.length + warns.length;
    const catIssues = after - before;
    catStats.push({ cat, spokes: blocks.length, issues: catIssues });
    const icon = catIssues === 0 ? '✅' : '❌';
    console.log(`${icon} ${cat.padEnd(6)} — ${blocks.length}개 spoke, ${catIssues}건 이슈`);
  }

  // 결과 출력
  if (errors.length > 0) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`❌ 오류 ${errors.length}건:\n`);
    for (const e of errors) {
      console.log(`  [${e.cat}/${e.slug}]`);
      console.log(`  └ ${e.msg}`);
      console.log(`  └ 발견: "${e.context}"`);
      console.log('');
    }
  }

  if (warns.length > 0) {
    console.log(`${'='.repeat(50)}`);
    console.log(`⚠️  경고 ${warns.length}건:\n`);
    for (const w of warns) {
      console.log(`  [${w.cat}/${w.slug}]`);
      console.log(`  └ ${w.msg}`);
      console.log(`  └ 발견: "${w.context}"`);
      console.log('');
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 검증 결과`);
  console.log(`   총 글 수: ${total}개`);
  console.log(`   ❌ 오류: ${errors.length}건`);
  console.log(`   ⚠️  경고: ${warns.length}건`);

  if (errors.length === 0 && warns.length === 0) {
    console.log('\n✅ 알려진 의학적 패턴 오류 없음!');
  } else {
    console.log('\n⚠️  위 내용을 검토하세요.');
  }
}

main();
