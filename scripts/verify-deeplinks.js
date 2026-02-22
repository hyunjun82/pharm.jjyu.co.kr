/**
 * 발키리 딥링크 검증 스크립트
 * 모든 제품의 발키리 링크가 유효한지 확인합니다.
 *
 * 사용법: node scripts/verify-deeplinks.js
 */

const products = [
  { name: "마데카솔 연고 10g", id: "p104" },
  { name: "후시딘 연고 5g", id: "p93" },
  { name: "비판텐 연고 30g", id: "p97" },
  { name: "미녹시딜 5% 60ml", id: "p135" },
  { name: "판콜에이 10정", id: "p13" },
  { name: "라미실 크림 15g", id: "p281" },
  { name: "타이레놀 500mg 10정", id: "p88" },
  { name: "이부프로펜 200mg 20정", id: "p267" },
  { name: "콘택600 10캡슐", id: "p442" },
  // 판토가: 발키리에 없음 (search fallback)
];

async function checkDeeplink(name, productId) {
  const url = `https://barkiri.com/products/${productId}`;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) {
      return { name, url, status: "OK", code: res.status };
    } else {
      return { name, url, status: "FAIL", code: res.status };
    }
  } catch (err) {
    return { name, url, status: "ERROR", code: err.message };
  }
}

async function main() {
  console.log("=== 발키리 딥링크 검증 ===\n");

  let passed = 0;
  let failed = 0;

  for (const { name, id } of products) {
    const result = await checkDeeplink(name, id);
    const icon = result.status === "OK" ? "✅" : "❌";
    console.log(`${icon} ${result.name} → ${result.url} [${result.code}]`);
    if (result.status === "OK") passed++;
    else failed++;
  }

  console.log(`\n--- 결과: ${passed}/${products.length} 통과, ${failed} 실패 ---`);

  if (failed > 0) {
    console.log("\n⚠️  실패한 딥링크가 있습니다. data/products.ts의 barkiryProductId를 확인하세요.");
    process.exit(1);
  }
}

main();
