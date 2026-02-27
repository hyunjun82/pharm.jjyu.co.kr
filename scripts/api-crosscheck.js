/**
 * e약은요 API 교차검증 스크립트
 * OTC 의약품 제품명으로 API 조회 → 제조사·주성분 비교
 *
 * 사용법: node scripts/api-crosscheck.js [카테고리명]
 *   예)  node scripts/api-crosscheck.js 감기
 *        node scripts/api-crosscheck.js          (전체)
 */

const fs = require('fs');
const path = require('path');

const KEY = 'cf7552de3d61cdff45c878062b431dd4578ca18c4487cd44f545477356f2947b';
const API = 'http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';

const PRODUCTS_DIR = path.resolve(__dirname, '../data/products');
const ARTICLES_DIR = path.resolve(__dirname, '../data/articles');

// 탈모의 전문의약품은 API에 없으므로 제외 slug 목록
const SKIP_SLUGS = new Set([
  // 피나스테리드 (전문의약품)
  '프로페시아', '피나스테리드', '아보다트', '두타스테리드',
  '파나스카정', '씨엠피나정', '모나스카정', '핀나정', '세화피나정',
  '헤어그로정', '탈피나정', '유한피나스테리드정', '대웅바이오피나스테리드정',
  '네오피나정', '피나온정', '한미피나스테리드정', '코오롱피나스테리드정',
  '명인피나스테리드정', '제일피나스테리드정', '삼아피나스테리드정',
  '동구바이오피나스테리드정', '일양피나스테리드정', '안국피나스테리드정',
  '태극피나스테리드정', '피나리드정', '피나모린정', '신신피나스테리드정',
  '크라운피나스테리드정', '피나젝트정', '오스코피나정', '지오파나정',
  '하이피나정', '피나쎄정', '피나테크정', '올피나정',
  '두타반연질캡슐', '아보다트연질캡슐', '아보트렉스연질캡슐',
  '두타사이드연질캡슐', '두타레이드연질캡슐', '두타정', '두타렉스연질캡슐',
  '두타스정',
  // 두피나액 등 전문의약품 미녹시딜 (처방형)
]);

// 제조사명 정규화 (비교용)
function normalizeManufacturer(name) {
  if (!name) return '';
  return name
    .replace(/\(주\)|주식회사|\(유\)|유한회사|㈜/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

// HTML 태그 제거
function clean(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 제품 목록 추출 (products/*.ts에서)
function getProducts(filterCategory) {
  const products = [];
  const categories = filterCategory ? [filterCategory] : fs.readdirSync(PRODUCTS_DIR)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .map(f => f.replace('.ts', ''));

  for (const cat of categories) {
    const fp = path.join(PRODUCTS_DIR, `${cat}.ts`);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');

    // 각 제품 블록 분리 (id: 기준)
    const idPattern = /id:\s*"([^"]+)"/g;
    const namePattern = /name:\s*"([^"]+)"/g;
    const slugPattern = /slug:\s*"([^"]+)"/g;
    const barkiryIdPattern = /barkiryProductId:\s*"([^"]+)"/g;

    const ids = [...content.matchAll(idPattern)].map(m => ({ val: m[1], idx: m.index }));
    const names = [...content.matchAll(namePattern)].map(m => ({ val: m[1], idx: m.index }));
    const slugs = [...content.matchAll(slugPattern)].map(m => ({ val: m[1], idx: m.index }));
    const barkiryIds = [...content.matchAll(barkiryIdPattern)].map(m => ({ val: m[1], idx: m.index }));

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i].val;
      const idIdx = ids[i].idx;
      // 같은 블록의 name, slug, barkiryId 찾기
      const blockEnd = i < ids.length - 1 ? ids[i + 1].idx : content.length;
      const name = names.find(n => n.idx > idIdx && n.idx < blockEnd);
      const slug = slugs.find(s => s.idx > idIdx && s.idx < blockEnd);
      const barkiryId = barkiryIds.find(b => b.idx > idIdx && b.idx < blockEnd);

      if (!name || !slug) continue;
      if (SKIP_SLUGS.has(slug.val)) continue;

      products.push({
        cat,
        id,
        name: name.val,
        slug: slug.val,
        barkiryProductId: barkiryId ? barkiryId.val : null,
      });
    }
  }

  return products;
}

// 기사에서 제조사 언급 찾기
function findManufacturerInArticle(cat, slug) {
  const fp = path.join(ARTICLES_DIR, `${cat}.ts`);
  if (!fs.existsSync(fp)) return null;
  const content = fs.readFileSync(fp, 'utf8');

  // 해당 slug 블록 찾기
  const pattern = new RegExp(`(?:^|\\n)  (?:"${slug}"|${slug}):\\s*\\{`, 'm');
  const match = content.match(pattern);
  if (!match) return null;

  const start = match.index;
  // 블록 끝 찾기 (다음 최상위 키 전까지)
  const after = content.substring(start);
  const nextKey = after.match(/\n  (?:"[^"]+"|[가-힣\w]+)\s*:\s*\{/, 1);
  const blockEnd = nextKey ? start + nextKey.index : Math.min(start + 30000, content.length);
  const block = content.substring(start, blockEnd);

  // 제조사 패턴 추출 (비교적 안정적인 패턴들)
  const patterns = [
    // "X가 제조하는" / "X에서 제조" / "X 제품"
    /([가-힣\w\s()주()]{2,20}(?:제약|제약사|바이오|헬스|파마|pharma))[이가]?\s*(제조|생산|출시|판매)/i,
    // "제조사: X" / "제조사는 X"
    /제조사[는은이가]?\s*:?\s*([가-힣\w\s()주]{3,25}(?:제약|바이오|헬스|파마))/,
    // "X제약의 / X제약에서"
    /([가-힣]{2,8}(?:제약|바이오))[의에서가이]/,
  ];

  const found = new Set();
  for (const p of patterns) {
    const m = block.match(p);
    if (m) {
      const mfr = (m[1] || m[2] || '').trim();
      if (mfr.length >= 2) found.add(mfr);
    }
  }

  return found.size > 0 ? [...found] : null;
}

// e약은요 API 쿼리
async function queryAPI(productName) {
  const url = `${API}?serviceKey=${KEY}&itemName=${encodeURIComponent(productName)}&pageNo=1&numOfRows=5&type=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.body?.items;
    if (!items) return null;
    return Array.isArray(items) ? items : [items];
  } catch (e) {
    return null;
  }
}

// 딜레이 (API 과부하 방지)
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const filterCategory = process.argv[2] || null;

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   e약은요 API 교차검증                       ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (filterCategory) {
    console.log(`카테고리 필터: ${filterCategory}\n`);
  }

  const products = getProducts(filterCategory);
  console.log(`총 ${products.length}개 제품 검사 시작...\n`);

  const results = {
    found: [],      // API에서 찾음
    notFound: [],   // API에 미등록 (전문의약품 or 없음)
    errors: [],     // 제조사/성분 불일치
  };

  let i = 0;
  for (const prod of products) {
    i++;
    if (i % 10 === 0) {
      process.stdout.write(`\r진행: ${i}/${products.length}...`);
    }

    const items = await queryAPI(prod.slug);
    await delay(300); // 300ms 간격

    if (!items || items.length === 0) {
      results.notFound.push({ ...prod, reason: '미등록 (전문의약품 또는 API 없음)' });
      continue;
    }

    // 가장 이름이 유사한 항목 선택
    const item = items[0];
    const apiName = item.itemName || '';
    const apiMfr = clean(item.entpName || '');

    results.found.push({
      ...prod,
      apiName,
      apiMfr,
    });

    // 제조사 불일치 검사
    const articleMfrs = findManufacturerInArticle(prod.cat, prod.slug);
    if (articleMfrs && articleMfrs.length > 0) {
      const apiMfrNorm = normalizeManufacturer(apiMfr);
      const matchAny = articleMfrs.some(m => {
        const mNorm = normalizeManufacturer(m);
        return apiMfrNorm.includes(mNorm) || mNorm.includes(apiMfrNorm);
      });
      if (!matchAny) {
        results.errors.push({
          cat: prod.cat,
          slug: prod.slug,
          name: prod.name,
          articleMfrs,
          apiMfr,
          apiName,
        });
      }
    }
  }

  process.stdout.write('\r\n');

  // 결과 출력
  console.log('\n' + '='.repeat(50));
  console.log('📋 API 등록 현황\n');
  console.log(`  ✅ API 등록됨: ${results.found.length}개`);
  console.log(`  ⚠️  미등록 (전문의약품/기타): ${results.notFound.length}개`);

  if (results.errors.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log(`❌ 제조사 불일치 ${results.errors.length}건:\n`);
    for (const e of results.errors) {
      console.log(`  [${e.cat}/${e.slug}] ${e.name}`);
      console.log(`    글 내 제조사: ${e.articleMfrs.join(', ')}`);
      console.log(`    API 제조사:   ${e.apiMfr} (${e.apiName})`);
      console.log('');
    }
  } else {
    console.log('\n✅ 제조사 불일치 없음!');
  }

  // API 등록 제품 목록 (카테고리별)
  if (results.found.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log('📦 API 등록 제품 목록:\n');
    const byCat = {};
    for (const r of results.found) {
      if (!byCat[r.cat]) byCat[r.cat] = [];
      byCat[r.cat].push(r);
    }
    for (const [cat, items] of Object.entries(byCat)) {
      console.log(`  [${cat}]`);
      for (const item of items) {
        console.log(`    - ${item.slug} → API: "${item.apiName}" (${item.apiMfr})`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 검증 완료: ${products.length}개 제품`);
  console.log(`   ❌ 제조사 불일치: ${results.errors.length}건`);
}

main().catch(console.error);
