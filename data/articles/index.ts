import { HubArticle, SpokeArticle } from "@/lib/types";
import { hub as 연고Hub, spokes as 연고Spokes } from "./연고";
import { hub as 탈모Hub, spokes as 탈모Spokes } from "./탈모";
import { hub as 감기Hub, spokes as 감기Spokes } from "./감기";
import { hub as 진통제Hub, spokes as 진통제Spokes } from "./진통제";
import { hub as 무좀Hub, spokes as 무좀Spokes } from "./무좀";
import { hub as 설사Hub, spokes as 설사Spokes } from "./설사";
import { hub as 소화제Hub, spokes as 소화제Spokes } from "./소화제";
import { hub as 안약Hub, spokes as 안약Spokes } from "./안약";
import { hub as 구강Hub, spokes as 구강Spokes } from "./구강";
import { hub as 파스Hub, spokes as 파스Spokes } from "./파스";
import { hub as 영양제Hub, spokes as 영양제Spokes } from "./영양제";
import { hub as 여성건강Hub, spokes as 여성건강Spokes } from "./여성건강";
import { hub as 외상소독Hub, spokes as 외상소독Spokes } from "./외상소독";
import { hub as 두드러기Hub, spokes as 두드러기Spokes } from "./두드러기";
import { hub as 구충제Hub, spokes as 구충제Spokes } from "./구충제";
import { hub as 변비Hub, spokes as 변비Spokes } from "./변비";
import { hub as 알레르기Hub, spokes as 알레르기Spokes } from "./알레르기";
import { hub as 제산제Hub, spokes as 제산제Spokes } from "./제산제";
import { hub as 상처관리Hub, spokes as 상처관리Spokes } from "./상처관리";

export const hubArticles: Record<string, HubArticle> = {
  연고: 연고Hub,
  탈모: 탈모Hub,
  감기: 감기Hub,
  진통제: 진통제Hub,
  무좀: 무좀Hub,
  설사: 설사Hub,
  소화제: 소화제Hub,
  안약: 안약Hub,
  구강: 구강Hub,
  파스: 파스Hub,
  영양제: 영양제Hub,
  여성건강: 여성건강Hub,
  외상소독: 외상소독Hub,
  두드러기: 두드러기Hub,
  구충제: 구충제Hub,
  변비: 변비Hub,
  알레르기: 알레르기Hub,
  제산제: 제산제Hub,
  상처관리: 상처관리Hub,
};

export const spokeArticles: Record<string, Record<string, SpokeArticle>> = {
  연고: 연고Spokes,
  탈모: 탈모Spokes,
  감기: 감기Spokes,
  진통제: 진통제Spokes,
  무좀: 무좀Spokes,
  설사: 설사Spokes,
  소화제: 소화제Spokes,
  안약: 안약Spokes,
  구강: 구강Spokes,
  파스: 파스Spokes,
  영양제: 영양제Spokes,
  여성건강: 여성건강Spokes,
  외상소독: 외상소독Spokes,
  두드러기: 두드러기Spokes,
  구충제: 구충제Spokes,
  변비: 변비Spokes,
  알레르기: 알레르기Spokes,
  제산제: 제산제Spokes,
  상처관리: 상처관리Spokes,
};

export function getHubArticle(categorySlug: string): HubArticle | undefined {
  return hubArticles[categorySlug];
}

export function getSpokeArticle(
  categorySlug: string,
  spokeSlug: string
): SpokeArticle | undefined {
  return spokeArticles[categorySlug]?.[spokeSlug];
}
