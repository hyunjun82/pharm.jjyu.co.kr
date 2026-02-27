/**
 * 이미지 없는 제품 분석 스크립트
 * - barkiryProductId 있지만 barkiri 이미지 없는 제품 (CDN 이미지 가져올 수 있음)
 * - barkiryProductId 없고 placeholder/svg인 제품 (수동 처리 필요)
 */
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.resolve(__dirname, '../data/products');
const IMAGES_DIR = path.resolve(__dirname, '../public/images');

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');

const canFetch = [];   // barkiryProductId 있는데 barkiri 이미지 없음 → CDN 가져오기 가능
const manualNeeded = []; // barkiryProductId 없고 placeholder/svg → 수동

for (const f of files) {
  const content = fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8');
  const cat = f.replace('.ts', '');

  const idPat = /id:\s*"([^"]+)"/g;
  const slugPat = /slug:\s*"([^"]+)"/g;
  const imgPat = /image:\s*"([^"]+)"/g;
  const bpidPat = /barkiryProductId:\s*"([^"]+)"/g;
  const namePat = /name:\s*"([^"]+)"/g;

  const ids = [...content.matchAll(idPat)].map(m => ({ v: m[1], i: m.index }));
  const slugs = [...content.matchAll(slugPat)].map(m => ({ v: m[1], i: m.index }));
  const imgs = [...content.matchAll(imgPat)].map(m => ({ v: m[1], i: m.index }));
  const bpids = [...content.matchAll(bpidPat)].map(m => ({ v: m[1], i: m.index }));
  const names = [...content.matchAll(namePat)].map(m => ({ v: m[1], i: m.index }));

  for (let k = 0; k < ids.length; k++) {
    const end = k < ids.length - 1 ? ids[k + 1].i : content.length;
    const slug = slugs.find(s => s.i > ids[k].i && s.i < end);
    const img = imgs.find(s => s.i > ids[k].i && s.i < end);
    const bpid = bpids.find(s => s.i > ids[k].i && s.i < end);
    const name = names.find(s => s.i > ids[k].i && s.i < end);

    if (!img) continue;
    const imgVal = img.v;
    const isBadImg = imgVal.includes('placeholder') || imgVal.endsWith('.svg');

    if (bpid && isBadImg) {
      canFetch.push({ cat, file: f, slug: slug?.v, name: name?.v, bpid: bpid.v, currentImg: imgVal });
    } else if (!bpid && isBadImg) {
      manualNeeded.push({ cat, file: f, slug: slug?.v, name: name?.v, currentImg: imgVal });
    }
  }
}

console.log('=== barkiryProductId 있는데 barkiri 이미지 없음 (CDN 이미지 가져오기 가능) ===');
console.log(`총 ${canFetch.length}개\n`);
const byCat1 = {};
for (const x of canFetch) {
  if (!byCat1[x.cat]) byCat1[x.cat] = [];
  byCat1[x.cat].push(x);
}
for (const [cat, items] of Object.entries(byCat1)) {
  console.log(`[${cat}] ${items.length}개`);
  items.forEach(x => console.log(`  - ${x.slug} (${x.bpid}) → ${x.currentImg}`));
}

console.log('\n=== barkiryProductId 없고 placeholder/svg (수동 처리 필요) ===');
console.log(`총 ${manualNeeded.length}개\n`);
const byCat2 = {};
for (const x of manualNeeded) {
  if (!byCat2[x.cat]) byCat2[x.cat] = [];
  byCat2[x.cat].push(x);
}
for (const [cat, items] of Object.entries(byCat2)) {
  console.log(`[${cat}] ${items.length}개`);
  items.slice(0, 5).forEach(x => console.log(`  - ${x.slug}: ${x.currentImg}`));
  if (items.length > 5) console.log(`  ... 외 ${items.length - 5}개`);
}
