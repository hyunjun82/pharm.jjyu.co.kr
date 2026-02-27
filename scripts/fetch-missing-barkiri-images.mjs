/**
 * barkiryProductId 있지만 barkiri 이미지 없는 제품 이미지 일괄 다운로드 + 데이터 업데이트
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = path.resolve(__dirname, '../data/products');
const IMAGES_DIR = path.resolve(__dirname, '../public/images');
const CDN = 'https://barkiri.edge.naverncp.com/product';

function getProductsNeedingImages() {
  const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  const results = [];

  for (const f of files) {
    const content = fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8');
    const cat = f.replace('.ts', '');

    const idPat = /id:\s*"([^"]+)"/g;
    const slugPat = /slug:\s*"([^"]+)"/g;
    const imgPat = /image:\s*"([^"]+)"/g;
    const bpidPat = /barkiryProductId:\s*"([^"]+)"/g;

    const ids = [...content.matchAll(idPat)].map(m => ({ v: m[1], i: m.index }));
    const slugs = [...content.matchAll(slugPat)].map(m => ({ v: m[1], i: m.index }));
    const imgs = [...content.matchAll(imgPat)].map(m => ({ v: m[1], i: m.index }));
    const bpids = [...content.matchAll(bpidPat)].map(m => ({ v: m[1], i: m.index }));

    for (let k = 0; k < ids.length; k++) {
      const end = k < ids.length - 1 ? ids[k + 1].i : content.length;
      const slug = slugs.find(s => s.i > ids[k].i && s.i < end);
      const img = imgs.find(s => s.i > ids[k].i && s.i < end);
      const bpid = bpids.find(s => s.i > ids[k].i && s.i < end);

      if (!bpid || !img) continue;
      const imgVal = img.v;
      const isBadImg = imgVal.includes('placeholder') || imgVal.endsWith('.svg');
      if (!isBadImg) continue;

      const targetImg = `/images/barkiri-${slug?.v}.webp`;
      const targetFile = path.join(IMAGES_DIR, `barkiri-${slug?.v}.webp`);

      // 이미 파일이 존재하면 데이터만 업데이트 필요
      const fileExists = fs.existsSync(targetFile);

      results.push({
        cat, file: f, slug: slug?.v,
        bpid: bpid.v, currentImg: imgVal,
        targetImg, targetFile, fileExists,
      });
    }
  }
  return results;
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return false;
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 500) return false; // 너무 작으면 실패로 간주
  fs.writeFileSync(dest, Buffer.from(buf));
  return true;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const products = getProductsNeedingImages();
  console.log(`총 ${products.length}개 제품 이미지 처리 시작\n`);

  const results = { ok: [], skip: [], fail: [] };

  // 카테고리별 파일 내용 캐시
  const fileCache = {};

  let i = 0;
  for (const p of products) {
    i++;
    process.stdout.write(`\r[${i}/${products.length}] ${p.slug}...`);

    let downloaded = p.fileExists;

    // 이미지 다운로드 (파일이 없는 경우)
    if (!p.fileExists) {
      const url = `${CDN}/${p.bpid}.webp`;
      try {
        downloaded = await downloadImage(url, p.targetFile);
      } catch (e) {
        downloaded = false;
      }
      await delay(150);
    }

    if (!downloaded && !p.fileExists) {
      results.fail.push(p);
      continue;
    }

    // 데이터 파일 업데이트
    if (!fileCache[p.file]) {
      fileCache[p.file] = fs.readFileSync(path.join(PRODUCTS_DIR, p.file), 'utf8');
    }

    // 해당 슬러그 블록에서 image 값만 교체
    const oldImgStr = `image: "${p.currentImg}"`;
    const newImgStr = `image: "${p.targetImg}"`;

    // slug 기반으로 정확한 블록 찾아서 교체 (첫 번째 발견만)
    const slugMarker = `slug: "${p.slug}"`;
    const slugIdx = fileCache[p.file].indexOf(slugMarker);
    if (slugIdx === -1) {
      results.fail.push({ ...p, reason: 'slug not found in file' });
      continue;
    }

    // slug 앞뒤 500자 범위에서 currentImg → targetImg 교체
    const searchStart = Math.max(0, slugIdx - 500);
    const searchEnd = Math.min(fileCache[p.file].length, slugIdx + 500);
    const before = fileCache[p.file].substring(0, searchStart);
    const middle = fileCache[p.file].substring(searchStart, searchEnd).replace(
      `image: "${p.currentImg}"`,
      `image: "${p.targetImg}"`
    );
    const after = fileCache[p.file].substring(searchEnd);
    fileCache[p.file] = before + middle + after;

    if (p.fileExists) {
      results.skip.push(p); // 파일은 있었고 데이터만 업데이트
    } else {
      results.ok.push(p);   // 새로 다운로드
    }
  }

  process.stdout.write('\n\n');

  // 파일 저장
  for (const [f, content] of Object.entries(fileCache)) {
    fs.writeFileSync(path.join(PRODUCTS_DIR, f), content);
  }

  console.log('=== 결과 ===');
  console.log(`✅ 새로 다운로드: ${results.ok.length}개`);
  console.log(`🔄 파일 있어서 데이터만 업데이트: ${results.skip.length}개`);
  console.log(`❌ 실패: ${results.fail.length}개`);

  if (results.fail.length > 0) {
    console.log('\n실패 목록:');
    results.fail.forEach(p => console.log(`  - [${p.cat}] ${p.slug} (${p.bpid})`));
  }

  console.log('\n완료!');
}

main().catch(console.error);
