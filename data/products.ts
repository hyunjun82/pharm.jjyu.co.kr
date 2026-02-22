import { Product } from "@/lib/types";

export const products: Product[] = [
  {
    id: "195700020",
    name: "활명수",
    image: "/images/placeholder.svg",
    category: "소화제",
    categorySlug: "소화제",
    description: "이 약은 식욕감퇴(식욕부진), 위부팽만감, 소화불량, 과식, 체함, 구역, 구토에 사용해요.",
    price: 0,
    unit: "1개",
    barkiryQuery: "활명수",
    ingredients: "",
    usage: "만 15세 이상 및 성인은 1회 1병(75 mL), 만 11세이상~만 15세미만은 1회 2/3병(50 mL), 만 8세 이상~만 11세 미만은 ...",
    slug: "활명수",
  },
  {
    id: "195900034",
    name: "신신티눈고(살리실산반창고)(수출명:SINSINCORNPLASTER)",
    image: "/images/placeholder.svg",
    category: "일반의약품",
    categorySlug: "일반",
    description: "이 약은 티눈, 못(굳은살), 사마귀에 사용해요.",
    price: 0,
    unit: "1개",
    barkiryQuery: "신신티눈고",
    ingredients: "",
    usage: "이형지로부터 벗겨 이 약제면을 환부(질환 부위)에 대고 테이프로 고정하고 2~5일마다 교체하여 붙이에요.",
    slug: "신신티눈고",
  },
  {
    id: "195900043",
    name: "아네모정",
    image: "/images/195900043.png",
    category: "소화제",
    categorySlug: "소화제",
    description: "이 약은 위산과다, 속쓰림, 위부불쾌감, 위부팽만감, 체함, 구역, 구토, 위통, 신트림에 사용해요.",
    price: 0,
    unit: "1개",
    barkiryQuery: "아네모정",
    ingredients: "",
    usage: "성인 1회 2정, 1일 3회 식간(식사와 식사때 사이) 및 취침시에 복용해요.",
    slug: "아네모정",
  },
  {
    id: "197100015",
    name: "타치온정50밀리그램(글루타티온(환원형))",
    image: "/images/placeholder.svg",
    category: "일반의약품",
    categorySlug: "일반",
    description: "이 약은 약물중독, 자가중독에 사용해요.",
    price: 0,
    unit: "1개",
    barkiryQuery: "타치온정50밀리그램)",
    ingredients: "",
    usage: "성인은 1회 1~2정(50~100 mg), 1일 1~3회 복용해요. 연령, 증상에 따라 적절히 증감해요.",
    slug: "타치온정50밀리그램)",
  },
  {
    id: "197100015",
    name: "타치온정50밀리그램(글루타티온(환원형))",
    image: "/images/197100015.png",
    category: "일반의약품",
    categorySlug: "일반",
    description: "이 약은 약물중독, 자가중독에 사용해요.",
    price: 0,
    unit: "1개",
    barkiryQuery: "타치온정50밀리그램)",
    ingredients: "",
    usage: "성인은 1회 1~2정(50~100 mg), 1일 1~3회 복용해요. 연령, 증상에 따라 적절히 증감해요.",
    slug: "타치온정50밀리그램)-2",
  }
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
