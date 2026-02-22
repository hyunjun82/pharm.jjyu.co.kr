export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  categorySlug: string;
  description: string;
  price: number;
  unit: string;
  barkiryQuery: string;
  barkiryProductId?: string;
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
  ingredients?: IngredientItem[];
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
