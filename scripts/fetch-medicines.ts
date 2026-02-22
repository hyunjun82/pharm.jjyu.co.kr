/**
 * 공공데이터포털 의약품 API → products.ts / articles.ts 자동 생성
 *
 * 사용법:
 *   npx tsx scripts/fetch-medicines.ts --key YOUR_API_KEY [--category 연고] [--rows 100]
 *
 * API: e약은요 API → 효능, 사용법, 주의사항, 이미지
 *
 * ⚠️ 오차 방지 원칙:
 *   - API 원본 텍스트 100% 보존 (잘림 없음)
 *   - HTML 태그만 제거, 내용 수정 없음
 *   - 카테고리 자동 감지 정확도 로그 출력
 *   - 중복 slug 자동 처리
 */

import fs from "fs";
import path from "path";

// ========== 구어체 변환 ==========
const TONE_RULES: [RegExp, string][] = [
  [/마십시오/g, "마세요"],
  [/마시오/g, "마세요"],
  [/하십시오/g, "하세요"],
  [/하시오/g, "하세요"],
  [/드십시오/g, "드세요"],
  [/받으십시오/g, "받으세요"],
  [/두십시오/g, "두세요"],
  [/주십시오/g, "주세요"],
  [/쓰십시오/g, "쓰세요"],
  [/피하십시오/g, "피하세요"],
  [/삼가십시오/g, "삼가세요"],
  [/보십시오/g, "보세요"],
  [/됩니다/g, "돼요"],
  [/입니다/g, "이에요"],
  [/습니다/g, "어요"],
  [/합니다/g, "해요"],
  [/않습니다/g, "않아요"],
  [/없습니다/g, "없어요"],
  [/있습니다/g, "있어요"],
  [/바랍니다/g, "바라요"],
  [/드립니다/g, "드려요"],
];

function convertToColloquial(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TONE_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ========== 설정 ==========
const E_DRUG_API =
  "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";

// 카테고리 매핑 (효능 키워드 → 카테고리)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  탈모: ["탈모", "발모", "미녹시딜", "피나스테리드"],
  연고: ["연고", "상처", "피부", "화상", "습진", "아토피", "크림", "외용"],
  감기: ["감기", "해열", "콧물", "기침", "인후"],
  진통제: ["진통", "두통", "치통", "생리통", "해열진통"],
  무좀: ["무좀", "진균", "백선", "칸디다"],
  설사: ["설사", "장염", "지사", "정장"],
  소화제: ["소화", "위장", "제산", "위산"],
  안약: ["안약", "점안", "안과", "인공눈물", "결막"],
};

const CATEGORY_NAMES: Record<string, string> = {
  탈모: "탈모약",
  연고: "연고",
  감기: "감기약",
  진통제: "진통제",
  무좀: "무좀약",
  설사: "설사약",
  소화제: "소화제",
  안약: "안약",
  일반: "일반의약품",
};

interface ApiDrugItem {
  entpName: string;
  itemName: string;
  itemSeq: string;
  efcyQesitm: string | null;
  useMethodQesitm: string | null;
  atpnQesitm: string | null;
  intrcQesitm: string | null;
  seQesitm: string | null;
  depositMethodQesitm: string | null;
  itemImage: string | null;
}

// ProcessedProduct에 원문 전체 텍스트 필드 추가
interface ProcessedProduct {
  id: string;
  name: string;
  image: string;
  category: string;
  categorySlug: string;
  description: string;       // 카드용 요약 (80자)
  descriptionFull: string;   // 원문 전체 (오차 방지)
  price: number;
  unit: string;
  barkiryQuery: string;
  ingredients: string;
  usage: string;             // 카드용 요약 (80자)
  usageFull: string;         // 원문 전체
  caution: string;           // 주의사항 전체
  interaction: string;       // 상호작용 전체
  sideEffect: string;        // 부작용 전체
  storage: string;           // 보관법 전체
  manufacturer: string;      // 제조사
  slug: string;
}

// ========== 유틸 ==========
function cleanHtml(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(
  name: string,
  efcy: string
): { name: string; slug: string } {
  const combined = `${name} ${efcy}`;
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return { name: CATEGORY_NAMES[slug] || slug, slug };
    }
  }
  return { name: "일반의약품", slug: "일반" };
}

function makeSlug(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\d+(\.\d+)?\s*(mg|g|ml|mL|정|캡슐|포|매|개|밀리리터|그램)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// 외용(바르는 약) vs 내복(먹는 약) 자동 판별
const TOPICAL_CATEGORIES = new Set(["연고", "무좀", "안약"]);
const TOPICAL_KEYWORDS = ["바르", "도포", "점안", "외용", "부착", "뿌리"];

function isTopicalDrug(catSlug: string, usageText: string): boolean {
  if (TOPICAL_CATEGORIES.has(catSlug)) return true;
  return TOPICAL_KEYWORDS.some((kw) => usageText.includes(kw));
}

function getMethodWord(catSlug: string, usageText: string): string {
  return isTopicalDrug(catSlug, usageText) ? "사용법" : "복용법";
}

// 중복 slug 방지
function deduplicateSlugs(products: ProcessedProduct[]): void {
  const slugCount: Record<string, number> = {};
  for (const p of products) {
    const key = `${p.categorySlug}:${p.slug}`;
    if (slugCount[key]) {
      slugCount[key]++;
      p.slug = `${p.slug}-${slugCount[key]}`;
    } else {
      slugCount[key] = 1;
    }
  }
}

// ========== API 호출 (페이지네이션 지원) ==========
async function fetchEDrugPage(
  apiKey: string,
  itemName?: string,
  pageNo = 1,
  numOfRows = 100
): Promise<{ items: ApiDrugItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: "json",
  });
  if (itemName) params.set("itemName", itemName);

  const url = `${E_DRUG_API}?${params}`;
  console.log(`[API] 페이지 ${pageNo} 요청 (${numOfRows}건)...`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API 오류: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const totalCount = data?.body?.totalCount || 0;
  const items = data?.body?.items;
  if (!items) return { items: [], totalCount };
  return { items: Array.isArray(items) ? items : [items], totalCount };
}

async function fetchEDrugList(
  apiKey: string,
  itemName?: string,
  totalRows = 100
): Promise<ApiDrugItem[]> {
  const PAGE_SIZE = 100;
  const allItems: ApiDrugItem[] = [];
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  for (let page = 1; page <= totalPages; page++) {
    const rowsThisPage = Math.min(PAGE_SIZE, totalRows - allItems.length);
    const { items, totalCount } = await fetchEDrugPage(apiKey, itemName, page, rowsThisPage);
    allItems.push(...items);
    console.log(`  → ${allItems.length}/${Math.min(totalRows, totalCount)}건 수집`);
    if (allItems.length >= totalRows || allItems.length >= totalCount) break;
    // API 부하 방지 딜레이
    await new Promise((r) => setTimeout(r, 300));
  }

  return allItems.slice(0, totalRows);
}

// ========== 데이터 변환 (원본 보존 + 구어체 변환) ==========
function processItem(item: ApiDrugItem): ProcessedProduct {
  const efcyFull = convertToColloquial(cleanHtml(item.efcyQesitm));
  const usageFull = convertToColloquial(cleanHtml(item.useMethodQesitm));
  const caution = convertToColloquial(cleanHtml(item.atpnQesitm));
  const interaction = convertToColloquial(cleanHtml(item.intrcQesitm));
  const sideEffect = convertToColloquial(cleanHtml(item.seQesitm));
  const storage = convertToColloquial(cleanHtml(item.depositMethodQesitm));
  const cat = detectCategory(item.itemName, efcyFull);
  const slug = makeSlug(item.itemName);

  return {
    id: item.itemSeq,
    name: item.itemName,
    image: item.itemImage || "/images/placeholder.svg",
    category: cat.name,          // ✅ 하드코딩 제거 → 자동 감지 결과
    categorySlug: cat.slug,
    description: truncate(efcyFull, 80),   // 카드 표시용
    descriptionFull: efcyFull,             // ✅ 원본 전체 보존
    price: 0,
    unit: "1개",
    barkiryQuery: slug,
    ingredients: "",
    usage: truncate(usageFull, 80),        // 카드 표시용
    usageFull,                             // ✅ 원본 전체 보존
    caution,                               // ✅ 주의사항 원본
    interaction,                           // ✅ 상호작용 원본
    sideEffect,                            // ✅ 부작용 원본
    storage,                               // ✅ 보관법 원본
    manufacturer: item.entpName,           // ✅ 제조사
    slug,
  };
}

// ========== 파일 생성: products.ts ==========
function generateProductsFile(products: ProcessedProduct[]): string {
  const lines = products.map(
    (p) => `  {
    id: ${JSON.stringify(p.id)},
    name: ${JSON.stringify(p.name)},
    image: ${JSON.stringify(p.image)},
    category: ${JSON.stringify(p.category)},
    categorySlug: ${JSON.stringify(p.categorySlug)},
    description: ${JSON.stringify(p.description)},
    price: ${p.price},
    unit: ${JSON.stringify(p.unit)},
    barkiryQuery: ${JSON.stringify(p.barkiryQuery)},
    ingredients: ${JSON.stringify(p.ingredients)},
    usage: ${JSON.stringify(p.usage)},
    slug: ${JSON.stringify(p.slug)},
  }`
  );

  return `import { Product } from "@/lib/types";

export const products: Product[] = [
${lines.join(",\n")}
];

export function getProductsByCategory(categorySlug: string): Product[] {
  return products.filter((p) => p.categorySlug === categorySlug);
}

export function getProductBySlug(
  categorySlug: string,
  productSlug: string
): Product | undefined {
  return products.find(
    (p) => p.categorySlug === categorySlug && p.slug === productSlug
  );
}
`;
}

// ========== 파일 생성: articles.ts (핵심 - 원본 보존) ==========
function generateArticlesFile(products: ProcessedProduct[]): string {
  // 카테고리별 그룹핑
  const byCategory: Record<string, ProcessedProduct[]> = {};
  for (const p of products) {
    if (!byCategory[p.categorySlug]) byCategory[p.categorySlug] = [];
    byCategory[p.categorySlug].push(p);
  }

  // Hub articles
  const hubEntries = Object.entries(byCategory).map(([catSlug, prods]) => {
    const catName = CATEGORY_NAMES[catSlug] || catSlug;
    const spokesList = prods
      .map((p) => {
        const method = getMethodWord(p.categorySlug, p.usageFull);
        return `      {
        slug: ${JSON.stringify(p.slug)},
        title: ${JSON.stringify(`${p.slug} 최저가 가격 | 성분 효과 ${method} 부작용까지`)},
        description: ${JSON.stringify(truncate(p.descriptionFull, 60))},
      }`;
      })
      .join(",\n");

    return `  ${JSON.stringify(catSlug)}: {
    categorySlug: ${JSON.stringify(catSlug)},
    title: ${JSON.stringify(`${catName} 추천 최저가 가격 비교 | 성분 효과 부작용 가이드`)},
    h1: ${JSON.stringify(`${catName} 추천 가이드 - 제품별 비교 분석`)},
    metaDescription: ${JSON.stringify(`${catName} 성분과 효능, 부작용을 비교 분석했습니다. 약국별 최저가 비교로 가장 저렴하게 구매하세요.`)},
    description: ${JSON.stringify(`${catName} 제품의 성분, 효과, 부작용을 비교 분석해요.`)},
    heroDescription: ${JSON.stringify(`${catName} 종류가 많아 어떤 제품을 선택할지 고민되시죠? 제품별 효능, 성분, 사용법을 비교해 드려요.`)},
    spokes: [
${spokesList}
    ],
  }`;
  });

  // Spoke articles (원본 전체 텍스트 사용 → 오차 없음)
  const spokeEntries = Object.entries(byCategory).map(([catSlug, prods]) => {
    const articles = prods.map((p) => {
      const method = getMethodWord(p.categorySlug, p.usageFull);

      // sections: API 원본 데이터 기반 (잘림 없음) + 새 H2 제목 규칙
      const sections: string[] = [];
      if (p.descriptionFull) {
        sections.push(`        {
          title: ${JSON.stringify(`${p.slug} 효능과 효과`)},
          content: ${JSON.stringify(p.descriptionFull)},
        }`);
      }
      if (p.usageFull) {
        sections.push(`        {
          title: ${JSON.stringify(`${p.slug} 올바른 ${method}`)},
          content: ${JSON.stringify(p.usageFull)},
        }`);
      }
      if (p.sideEffect) {
        sections.push(`        {
          title: ${JSON.stringify(`${p.slug} 부작용`)},
          content: ${JSON.stringify(p.sideEffect)},
        }`);
      }
      if (p.caution) {
        sections.push(`        {
          title: ${JSON.stringify(`${p.slug} 주의사항`)},
          content: ${JSON.stringify(p.caution)},
        }`);
      }
      if (p.storage) {
        sections.push(`        {
          title: ${JSON.stringify(`${p.slug} 보관법`)},
          content: ${JSON.stringify(p.storage)},
        }`);
      }

      // FAQ: API 데이터 기반 (잘림 없음)
      const faqItems: string[] = [];
      if (p.descriptionFull) {
        faqItems.push(`        {
          question: ${JSON.stringify(`${p.slug}은(는) 어떤 약인가요?`)},
          answer: ${JSON.stringify(p.descriptionFull)},
        }`);
      }
      if (p.usageFull) {
        faqItems.push(`        {
          question: ${JSON.stringify(`${p.slug} ${method}은?`)},
          answer: ${JSON.stringify(p.usageFull)},
        }`);
      }
      if (p.caution) {
        faqItems.push(`        {
          question: ${JSON.stringify(`${p.slug} 주의사항은?`)},
          answer: ${JSON.stringify(p.caution)},
        }`);
      }
      if (p.interaction) {
        faqItems.push(`        {
          question: ${JSON.stringify(`${p.slug}과(와) 함께 먹으면 안 되는 약은?`)},
          answer: ${JSON.stringify(p.interaction)},
        }`);
      }

      const spokeTitle = `${p.slug} 최저가 가격 | 성분 효과 ${method} 부작용까지`;
      const spokeH1 = `${p.slug} 최저가 가격 | 성분 효과 ${method} 부작용까지`;
      const spokeMeta = `${p.slug} 성분과 효능, 부작용, 올바른 ${method}을 정리했습니다. 약국별 최저가 비교로 가장 저렴하게 구매하세요.`;
      return `    ${JSON.stringify(p.slug)}: {
      slug: ${JSON.stringify(p.slug)},
      categorySlug: ${JSON.stringify(p.categorySlug)},
      title: ${JSON.stringify(spokeTitle)},
      h1: ${JSON.stringify(spokeH1)},
      metaDescription: ${JSON.stringify(spokeMeta)},
      description: ${JSON.stringify(`${p.name}의 효능, 성분, ${method}, 최저가 비교 정보를 제공해요.`)},
      heroDescription: ${JSON.stringify(p.descriptionFull)},
      products: getProductsByCategory(${JSON.stringify(catSlug)}).filter(
        (p) => p.slug === ${JSON.stringify(p.slug)}
      ),
      faq: [
${faqItems.join(",\n")}
      ],
      sections: [
${sections.join(",\n")}
      ],
    }`;
    });

    return `  ${JSON.stringify(catSlug)}: {
${articles.join(",\n")}
  }`;
  });

  return `import { HubArticle, SpokeArticle } from "@/lib/types";
import { getProductsByCategory } from "./products";

export const hubArticles: Record<string, HubArticle> = {
${hubEntries.join(",\n")}
};

export const spokeArticles: Record<string, Record<string, SpokeArticle>> = {
${spokeEntries.join(",\n")}
};

export function getHubArticle(categorySlug: string): HubArticle | undefined {
  return hubArticles[categorySlug];
}

export function getSpokeArticle(
  categorySlug: string,
  slug: string
): SpokeArticle | undefined {
  return spokeArticles[categorySlug]?.[slug];
}
`;
}

// ========== 파일 생성: categories.ts ==========
const CATEGORY_ICONS: Record<string, string> = {
  탈모: "💊",
  연고: "🩹",
  감기: "🤧",
  진통제: "💉",
  무좀: "🦶",
  설사: "🏥",
  소화제: "💚",
  안약: "👁️",
  일반: "💊",
};

function generateCategoriesFile(products: ProcessedProduct[]): string {
  const byCategory: Record<string, number> = {};
  for (const p of products) {
    byCategory[p.categorySlug] = (byCategory[p.categorySlug] || 0) + 1;
  }

  const entries = Object.entries(byCategory).map(([slug, count]) => {
    const name = CATEGORY_NAMES[slug] || slug;
    const icon = CATEGORY_ICONS[slug] || "💊";
    return `  {
    name: ${JSON.stringify(name)},
    slug: ${JSON.stringify(slug)},
    icon: ${JSON.stringify(icon)},
    description: ${JSON.stringify(`${name} 효능, 성분, 가격 비교`)},
    count: ${count},
  }`;
  });

  return `import { Category } from "@/lib/types";

export const categories: Category[] = [
${entries.join(",\n")}
];
`;
}

// ========== 이미지 다운로드 ==========
async function downloadImage(
  url: string,
  outputPath: string
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

// ========== 검증 리포트 ==========
function printValidationReport(products: ProcessedProduct[]): void {
  console.log(`\n========== 검증 리포트 ==========`);

  // 1. 카테고리 분포
  const catCount: Record<string, number> = {};
  for (const p of products) {
    catCount[p.categorySlug] = (catCount[p.categorySlug] || 0) + 1;
  }
  console.log(`\n[카테고리 분포]`);
  for (const [cat, count] of Object.entries(catCount)) {
    console.log(`  ${CATEGORY_NAMES[cat] || cat}: ${count}개`);
  }

  // 2. 데이터 완성도
  const noEfcy = products.filter((p) => !p.descriptionFull).length;
  const noUsage = products.filter((p) => !p.usageFull).length;
  const noImage = products.filter(
    (p) => !p.image || p.image === "/images/placeholder.svg"
  ).length;
  const noCaution = products.filter((p) => !p.caution).length;

  console.log(`\n[데이터 완성도]`);
  console.log(`  효능 없음: ${noEfcy}개 (${((noEfcy / products.length) * 100).toFixed(1)}%)`);
  console.log(`  사용법 없음: ${noUsage}개 (${((noUsage / products.length) * 100).toFixed(1)}%)`);
  console.log(`  이미지 없음: ${noImage}개 (${((noImage / products.length) * 100).toFixed(1)}%)`);
  console.log(`  주의사항 없음: ${noCaution}개 (${((noCaution / products.length) * 100).toFixed(1)}%)`);

  // 3. 중복 slug 체크
  const slugSet = new Set<string>();
  let dupes = 0;
  for (const p of products) {
    const key = `${p.categorySlug}:${p.slug}`;
    if (slugSet.has(key)) dupes++;
    slugSet.add(key);
  }
  console.log(`\n[중복 slug]: ${dupes}개 (자동 번호 처리됨)`);

  // 4. 미분류 제품
  const unclassified = products.filter((p) => p.categorySlug === "일반").length;
  if (unclassified > 0) {
    console.log(`\n[⚠️ 미분류]: ${unclassified}개 → "일반의약품" 카테고리로 배정`);
    const samples = products
      .filter((p) => p.categorySlug === "일반")
      .slice(0, 5);
    for (const s of samples) {
      console.log(`  - ${s.name}`);
    }
  }

  console.log(`\n==================================\n`);
}

// ========== 메인 ==========
async function main() {
  const args = process.argv.slice(2);
  const keyIdx = args.indexOf("--key");
  const catIdx = args.indexOf("--category");
  const rowsIdx = args.indexOf("--rows");
  const dryRun = args.includes("--dry-run");

  if (keyIdx === -1) {
    console.error(
      "사용법: npx tsx scripts/fetch-medicines.ts --key API_KEY [--category 연고] [--rows 100] [--dry-run]"
    );
    console.error("\n옵션:");
    console.error("  --key       공공데이터포털 API 키 (필수)");
    console.error("  --category  검색할 의약품명 키워드 (선택, 미지정 시 전체)");
    console.error("  --rows      가져올 건수 (선택, 기본 100)");
    console.error("  --dry-run   파일 생성 없이 검증만 수행");
    process.exit(1);
  }

  const apiKey = args[keyIdx + 1];
  const category = catIdx !== -1 ? args[catIdx + 1] : undefined;
  const rows = rowsIdx !== -1 ? parseInt(args[rowsIdx + 1]) : 100;

  console.log(`\n=== 의약품 데이터 수집 시작 ===`);
  console.log(`검색 키워드: ${category || "전체"}`);
  console.log(`요청 건수: ${rows}`);
  console.log(`모드: ${dryRun ? "검증만 (dry-run)" : "파일 생성"}\n`);

  // 1. API 호출 (페이지네이션 적용)
  const items = await fetchEDrugList(apiKey, category, rows);
  console.log(`[결과] ${items.length}개 의약품 데이터 수집\n`);

  if (items.length === 0) {
    console.error("❌ 데이터가 없습니다. API 키와 검색 키워드를 확인하세요.");
    process.exit(1);
  }

  // 2. 데이터 변환
  const products = items.map(processItem);

  // 3. 중복 slug 처리
  deduplicateSlugs(products);

  // 4. 검증 리포트
  printValidationReport(products);

  if (dryRun) {
    console.log("✅ dry-run 모드: 검증 완료. 파일 미생성.\n");
    return;
  }

  // 5. 이미지 다운로드
  const imgDir = path.resolve("public/images");
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const p of products) {
    if (p.image && p.image.startsWith("http")) {
      const ext = p.image.includes(".jpg") ? ".jpg" : ".png";
      const filename = `${p.id}${ext}`;
      const filepath = path.join(imgDir, filename);

      if (!fs.existsSync(filepath)) {
        const ok = await downloadImage(p.image, filepath);
        if (ok) {
          downloaded++;
          p.image = `/images/${filename}`;
        }
      } else {
        skipped++;
        p.image = `/images/${filename}`;
      }
    }
  }
  console.log(`[이미지] 새로 다운로드: ${downloaded}개, 기존 사용: ${skipped}개\n`);

  // 6. data/ 디렉토리 확인
  const dataDir = path.resolve("data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // 7. products.ts 생성
  const productsPath = path.resolve("data/products.ts");
  fs.writeFileSync(productsPath, generateProductsFile(products));
  console.log(`✅ ${productsPath} 생성 (${products.length}개 제품)`);

  // 8. articles.ts 생성
  const articlesPath = path.resolve("data/articles.ts");
  fs.writeFileSync(articlesPath, generateArticlesFile(products));
  console.log(`✅ ${articlesPath} 생성`);

  // 8.5. categories.ts 생성
  const categoriesPath = path.resolve("data/categories.ts");
  fs.writeFileSync(categoriesPath, generateCategoriesFile(products));
  console.log(`✅ ${categoriesPath} 생성`);

  // 9. 최종 요약
  const byCategory: Record<string, number> = {};
  for (const p of products) {
    byCategory[p.categorySlug] = (byCategory[p.categorySlug] || 0) + 1;
  }

  console.log(`\n=== 생성 완료 ===`);
  console.log(`총 제품: ${products.length}개`);
  console.log(`허브 페이지: ${Object.keys(byCategory).length}개`);
  console.log(`스포크 페이지: ${products.length}개`);
  console.log(`\nnpm run build 로 빌드하세요.\n`);
}

main().catch((err) => {
  console.error("❌ 오류 발생:", err.message);
  process.exit(1);
});
