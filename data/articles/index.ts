import { HubArticle, SpokeArticle } from "@/lib/types";

// ──────────────────────────────────────────────
// Hub 데이터만 번들에 포함 (약 100KB)
// Spoke 데이터는 public/data/ JSON에서 fetch로 로드
// ──────────────────────────────────────────────

import { hub as 연고Hub } from "./연고";
import { hub as 탈모Hub } from "./탈모";
import { hub as 감기Hub } from "./감기";
import { hub as 진통제Hub } from "./진통제";
import { hub as 무좀Hub } from "./무좀";
import { hub as 설사Hub } from "./설사";
import { hub as 소화제Hub } from "./소화제";
import { hub as 안약Hub } from "./안약";
import { hub as 구강Hub } from "./구강";
import { hub as 파스Hub } from "./파스";
import { hub as 영양제Hub } from "./영양제";
import { hub as 여성건강Hub } from "./여성건강";
import { hub as 외상소독Hub } from "./외상소독";
import { hub as 두드러기Hub } from "./두드러기";
import { hub as 구충제Hub } from "./구충제";
import { hub as 변비Hub } from "./변비";
import { hub as 알레르기Hub } from "./알레르기";
import { hub as 제산제Hub } from "./제산제";

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
};

export function getHubArticle(categorySlug: string): HubArticle | undefined {
  return hubArticles[categorySlug];
}

// ──────────────────────────────────────────────
// Spoke 데이터: public/data/{category}/{slug}.json에서 fetch
// Worker 번들에 15MB 데이터가 포함되지 않음
// ──────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://pharm.jjyu.co.kr";

export async function getSpokeArticle(
  categorySlug: string,
  spokeSlug: string
): Promise<SpokeArticle | undefined> {
  try {
    const url = `${BASE_URL}/data/${encodeURIComponent(categorySlug)}/${encodeURIComponent(spokeSlug)}.json`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return undefined;
    return res.json() as Promise<SpokeArticle>;
  } catch {
    return undefined;
  }
}

// ──────────────────────────────────────────────
// Spoke 인덱스: sitemap, home page용
// public/data/spoke-index.json에서 fetch
// ──────────────────────────────────────────────

export async function getSpokeIndex(): Promise<
  Record<string, Record<string, { slug: string; dateModified: string }>>
> {
  try {
    const url = `${BASE_URL}/data/spoke-index.json`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}
