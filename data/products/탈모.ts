import { Product } from "@/lib/types";

export const products: Product[] = [
  {
      id: "minoxidil-60ml",
      name: "미녹시딜 5% 60ml",
      image: "/images/minoxidil.svg",
      category: "일반의약품",
      categorySlug: "탈모",
      description: "남성형 탈모 치료. FDA 승인 탈모 치료 성분.",
      price: 14000,
      unit: "60ml",
      barkiryQuery: "미녹시딜",
      barkiryProductId: "p135",
      ingredients: "미녹시딜",
      usage: "1일 2회, 1ml씩 두피에 도포",
      slug: "미녹시딜",
    },
  {
      id: "pantogar-90caps",
      name: "판토가 캡슐 90캡슐",
      image: "/images/pantogar.svg",
      category: "일반의약품",
      categorySlug: "탈모",
      description: "여성형 탈모, 모발 영양 공급. 복합 비타민·아미노산.",
      price: 45000,
      unit: "90캡슐",
      barkiryQuery: "판토가",
      externalSearchUrl: "https://search.shopping.naver.com/search/all?query=판토가+캡슐",
      ingredients: "비타민B1,판토텐산칼슘,약용효모,L-시스틴,케라틴,파라아미노벤조산",
      usage: "1일 3회, 1캡슐씩 식사와 함께 복용",
      slug: "판토가",
    },
];
