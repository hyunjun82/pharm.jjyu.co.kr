import { Product } from "@/lib/types";
import { products as 연고Products } from "./연고";
import { products as 탈모Products } from "./탈모";
import { products as 감기Products } from "./감기";
import { products as 진통제Products } from "./진통제";
import { products as 무좀Products } from "./무좀";
import { products as 설사Products } from "./설사";
import { products as 소화제Products } from "./소화제";
import { products as 안약Products } from "./안약";
import { products as 구강Products } from "./구강";
import { products as 파스Products } from "./파스";
import { products as 영양제Products } from "./영양제";
import { products as 여성건강Products } from "./여성건강";

export const products: Product[] = [
  ...연고Products,
  ...탈모Products,
  ...감기Products,
  ...진통제Products,
  ...무좀Products,
  ...설사Products,
  ...소화제Products,
  ...안약Products,
  ...구강Products,
  ...파스Products,
  ...영양제Products,
  ...여성건강Products,
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
