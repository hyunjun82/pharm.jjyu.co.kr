/**
 * 약정보 글 품질 검증 스크립트 (18항목)
 * 마데카솔 기준으로 모든 스포크 글의 품질을 자동 검증합니다.
 *
 * 사용법: npx tsx scripts/validate-articles.ts
 */

import { spokeArticles, hubArticles } from "../data/articles";
import { products } from "../data/products";
import type { SpokeArticle } from "../lib/types";

/* ── 검증 결과 타입 ──────────────────── */
interface CheckResult {
  id: number;
  name: string;
  passed: boolean;
  detail?: string;
}

/* ── 경어체/딱딱한 표현 패턴 ────────────── */
const FORMAL_PATTERNS = [
  /습니다/,
  /하십시오/,
  /됩니다/,
  /있습니다/,
  /없습니다/,
  /바랍니다/,
  /마십시오/,
  /드립니다/,
  /입니다(?!\.)/,  // "이에요" 로 변환되어야 할 것
];

/* ── 필수 소제목 키워드 ─────────────────── */
const REQUIRED_SECTION_KEYWORDS = [
  "성분",
  "효능",
  /사용법|복용법/,
  "부작용",
  "주의사항",
  "보관",
];

/* ── 단일 글 검증 (18항목) ──────────────── */
function validateArticle(
  catSlug: string,
  slug: string,
  article: SpokeArticle
): CheckResult[] {
  const results: CheckResult[] = [];

  // ── 1. 타이틀 형식
  const titlePattern = new RegExp(
    `^${slug} 최저가 가격 \\| 성분 효과 (사용법|복용법) 부작용까지$`
  );
  results.push({
    id: 1,
    name: "타이틀 형식",
    passed: titlePattern.test(article.title),
    detail: article.title,
  });

  // ── 2. H1 = 타이틀
  results.push({
    id: 2,
    name: "H1 = 타이틀",
    passed: article.h1 === article.title,
    detail: article.h1 === article.title ? "일치" : `H1: "${article.h1}"`,
  });

  // ── 3. metaDescription
  const metaOk =
    article.metaDescription.length <= 155 &&
    article.metaDescription.length > 0 &&
    article.metaDescription.includes(slug);
  results.push({
    id: 3,
    name: "metaDescription",
    passed: metaOk,
    detail: `${article.metaDescription.length}자, slug 포함: ${article.metaDescription.includes(slug)}`,
  });

  // ── 4. heroDescription (서론)
  const heroNotEmpty = article.heroDescription.length > 0;
  const heroNotDuplicate =
    article.sections.length > 0 &&
    article.heroDescription !== article.sections[0].content;
  results.push({
    id: 4,
    name: "heroDescription (서론)",
    passed: heroNotEmpty && heroNotDuplicate,
    detail: heroNotEmpty
      ? heroNotDuplicate
        ? "고유 서론 확인"
        : "❌ 효능 섹션과 동일 (복사됨)"
      : "❌ 비어있음",
  });

  // ── 5. 스키마 데이터 (faq + products 존재 → 스키마 자동 생성됨)
  const hasSchemaData =
    article.faq.length > 0 && article.products.length > 0;
  results.push({
    id: 5,
    name: "스키마 데이터",
    passed: hasSchemaData,
    detail: `FAQ: ${article.faq.length}개, Products: ${article.products.length}개`,
  });

  // ── 6. 섹션 6개 이상
  results.push({
    id: 6,
    name: "섹션 6개 이상",
    passed: article.sections.length >= 6,
    detail: `현재 ${article.sections.length}개`,
  });

  // ── 7. 소제목에 약이름 포함
  const titlesWithSlug = article.sections.filter((s) =>
    s.title.includes(slug)
  );
  results.push({
    id: 7,
    name: "소제목에 약이름",
    passed: titlesWithSlug.length === article.sections.length,
    detail: `${titlesWithSlug.length}/${article.sections.length} 포함`,
  });

  // ── 8. 필수 소제목 키워드
  const missingKeywords = REQUIRED_SECTION_KEYWORDS.filter((kw) => {
    if (kw instanceof RegExp) {
      return !article.sections.some((s) => kw.test(s.title));
    }
    return !article.sections.some((s) => s.title.includes(kw));
  });
  results.push({
    id: 8,
    name: "필수 소제목 키워드",
    passed: missingKeywords.length === 0,
    detail:
      missingKeywords.length === 0
        ? "6개 키워드 모두 포함"
        : `누락: ${missingKeywords.map((k) => (k instanceof RegExp ? k.source : k)).join(", ")}`,
  });

  // ── 9. 성분 테이블
  const firstSection = article.sections[0];
  const hasIngredients =
    firstSection?.ingredients && firstSection.ingredients.length >= 1;
  results.push({
    id: 9,
    name: "성분 테이블",
    passed: !!hasIngredients,
    detail: hasIngredients
      ? `${firstSection.ingredients!.length}개 성분`
      : "❌ 성분 테이블 없음",
  });

  // ── 10. 각 섹션 글자수 >= 200자
  const shortSections = article.sections.filter(
    (s) => s.content.length < 200
  );
  results.push({
    id: 10,
    name: "섹션 글자수 ≥200자",
    passed: shortSections.length === 0,
    detail:
      shortSections.length === 0
        ? `전체 OK (평균 ${Math.round(article.sections.reduce((a, s) => a + s.content.length, 0) / article.sections.length)}자)`
        : `❌ ${shortSections.map((s) => `"${s.title}": ${s.content.length}자`).join(", ")}`,
  });

  // ── 11. 문단 구분 (\n\n 2개 이상 = 3문단)
  const noParagraphs = article.sections.filter(
    (s) => s.content.split("\n\n").length < 2
  );
  results.push({
    id: 11,
    name: "문단 구분 (\\n\\n)",
    passed: noParagraphs.length === 0,
    detail:
      noParagraphs.length === 0
        ? "전체 OK"
        : `❌ 단일 문단: ${noParagraphs.map((s) => `"${s.title}"`).join(", ")}`,
  });

  // ── 12. FAQ 3개 이상 + 고유 답변
  const faqOk = article.faq.length >= 3;
  const faqDuplicate = article.faq.some((f) =>
    article.sections.some((s) => s.content === f.answer)
  );
  results.push({
    id: 12,
    name: "FAQ 3개 이상 + 고유",
    passed: faqOk && !faqDuplicate,
    detail: `${article.faq.length}개${faqDuplicate ? ", ❌ 섹션 내용 복사됨" : ""}`,
  });

  // ── 13. ProductCard (상단 버튼)
  const hasProduct =
    article.products.length >= 1 &&
    article.products[0]?.barkiryQuery !== undefined;
  results.push({
    id: 13,
    name: "ProductCard",
    passed: hasProduct,
    detail: hasProduct
      ? `${article.products[0].name} (barkiryQuery: ${article.products[0].barkiryQuery})`
      : "❌ 상품 없음",
  });

  // ── 14. 바키리 딥링크
  const barkiry = article.products[0]?.barkiryQuery;
  const barkiryOk =
    !!barkiry && barkiry.length > 0 && barkiry.includes(slug);
  results.push({
    id: 14,
    name: "바키리 딥링크",
    passed: barkiryOk,
    detail: barkiryOk
      ? `barkiri.com/search?query=${barkiry}`
      : `❌ barkiryQuery: "${barkiry || "없음"}"`,
  });

  // ── 15. 가격 CTA (사용법/복용법 섹션 존재)
  const hasMethodSection = article.sections.some(
    (s) => s.title.includes("사용법") || s.title.includes("복용법")
  );
  results.push({
    id: 15,
    name: "가격 CTA 위치",
    passed: hasMethodSection,
    detail: hasMethodSection
      ? "사용법/복용법 섹션 있음 → PriceCTA 자동 삽입"
      : "❌ 사용법/복용법 섹션 없음",
  });

  // ── 16. 내부링크 (같은 카테고리 spoke 2개 이상)
  const hub = hubArticles[catSlug];
  const otherSpokes = hub
    ? hub.spokes.filter((s) => s.slug !== slug).length
    : 0;
  results.push({
    id: 16,
    name: "내부링크 (RelatedSpokes)",
    passed: otherSpokes >= 2,
    detail: `같은 카테고리 다른 spoke: ${otherSpokes}개${otherSpokes < 2 ? " (2개 이상 필요)" : ""}`,
  });

  // ── 17. 같은 카테고리 다른 의약품
  const sameCatProducts = products.filter(
    (p) => p.categorySlug === catSlug && p.slug !== slug
  );
  results.push({
    id: 17,
    name: "같은 카테고리 상품",
    passed: sameCatProducts.length >= 1,
    detail: `${sameCatProducts.length}개`,
  });

  // ── 18. 구어체 톤
  const allContent = article.sections.map((s) => s.content).join(" ");
  const formalFound = FORMAL_PATTERNS.filter((p) => p.test(allContent));
  results.push({
    id: 18,
    name: "구어체 톤",
    passed: formalFound.length === 0,
    detail:
      formalFound.length === 0
        ? "경어체 없음 ✓"
        : `❌ 발견: ${formalFound.map((p) => p.source).join(", ")}`,
  });

  return results;
}

/* ── 메인 실행 ──────────────────────── */
function main() {
  console.log("=== 약정보 글 품질 검증 (18항목) ===\n");

  let totalArticles = 0;
  let passedArticles = 0;
  const allResults: { key: string; results: CheckResult[] }[] = [];

  for (const [catSlug, spokes] of Object.entries(spokeArticles)) {
    for (const [slug, article] of Object.entries(spokes)) {
      totalArticles++;
      const results = validateArticle(catSlug, slug, article);
      const passed = results.filter((r) => r.passed).length;
      const failed = results.filter((r) => !r.passed);
      const isFullPass = failed.length === 0;

      if (isFullPass) passedArticles++;

      // 출력
      const icon = isFullPass ? "✅" : "❌";
      console.log(`${icon} ${slug}: ${passed}/${results.length} 통과`);

      if (!isFullPass) {
        for (const f of failed) {
          console.log(`   ❌ [${f.id}] ${f.name}: ${f.detail || ""}`);
        }
      }

      console.log();
      allResults.push({ key: `${catSlug}/${slug}`, results });
    }
  }

  // 요약
  console.log("─".repeat(40));
  console.log(
    `전체: ${passedArticles}/${totalArticles} 통과, ${totalArticles - passedArticles}/${totalArticles} 실패`
  );

  if (passedArticles === totalArticles) {
    console.log("\n🎉 모든 글이 18항목 검증을 통과했습니다!");
  } else {
    console.log("\n⚠️  실패한 글이 있습니다. 위 항목을 수정해 주세요.");
  }

  // exit code: 실패 글 있으면 1
  process.exit(passedArticles === totalArticles ? 0 : 1);
}

main();
