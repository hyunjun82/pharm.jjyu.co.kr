export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  categorySlug: string;
  description: string;
  price: number;
  unit: string;
  barkiryQuery?: string;
  barkiryProductId?: string;
  externalSearchUrl?: string;
  ingredients?: string;
  usage?: string;
  slug: string;
}

export interface Category {
  name: string;
  slug: string;
  icon: string;
  description: string;
  count: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SpokeArticle {
  slug: string;
  categorySlug: string;
  title: string;
  h1: string;
  metaDescription: string;
  description: string;
  heroDescription: string;
  products: Product[];
  faq: FAQItem[];
  sections: ArticleSection[];
  datePublished?: string;
  dateModified?: string;
  searchIntent?: "A" | "B" | "C" | "D" | "E" | "F";
  differentiationAnchor?:
    | "form"
    | "dose"
    | "age"
    | "gender"
    | "timing"
    | "comorbidity"
    | "priceTier"
    | "prescription"
    | "nutrition";
  ingredientGroup?: string;
  priceRange?: { min: number; max: number; storeCount: number };
  /** 성분군 허브 글에서 본문 첫 화면 목차를 노출할지 */
  showToc?: boolean;
  /** 목차 아래에 표기할 데이터 기준일 문구 */
  asOfNote?: string;
}

export interface IngredientItem {
  type: "주성분" | "첨가제";
  name: string;
  amount?: string;
  role: string;
}

export interface ArticleSection {
  title: string;
  content: string;
  data?: string;
  ingredients?: IngredientItem[];
  sectionType?: "default" | "timeline" | "comparison" | "calculator";
  /**
   * 이 섹션 바로 뒤에 가격비교 CTA를 붙인다.
   * 지정하면 제목에 '가격'이 들어갔는지 보는 자동 판정을 쓰지 않는다.
   * 제목이 두 개 이상 '가격'을 포함할 때 CTA가 중복 노출되는 걸 막는다.
   */
  ctaAfter?: boolean;
  _qa?: {
    verified?: string;
    charCount?: number;
    issues?: string[];
  };
}

export interface HubArticle {
  categorySlug: string;
  title: string;
  h1: string;
  metaDescription: string;
  description: string;
  heroDescription: string;
  spokes: { slug: string; title: string; description: string }[];
  datePublished?: string;
  dateModified?: string;
}
