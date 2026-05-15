// scripts/rewrite-talmo-v3.js
// 탈모-4.ts + 탈모-5.ts v3 일괄 리라이트
// 실행: node scripts/rewrite-talmo-v3.js

const fs = require("fs");
const path = require("path");

const TODAY = "2026-05-03";
const SOURCE_DIR = path.join(__dirname, "../source-data");
const ARTICLES_DIR = path.join(__dirname, "../data/articles");

// ── 1. 조사 헬퍼 ─────────────────────────────────────────────
// 받침 여부로 은/는, 이/가, 으로/로 결정
function hasBatchim(str) {
  if (!str) return false;
  const code = str.charCodeAt(str.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

// "으로/로" - ㄹ받침이면 "로", 다른 받침이면 "으로", 받침없으면 "로"
function getRo(str) {
  if (!str) return "으로";
  const code = str.charCodeAt(str.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return "로";
  const batchim = (code - 0xAC00) % 28;
  if (batchim === 0) return "로";     // 받침 없음
  if (batchim === 8) return "로";     // ㄹ 받침 (8번)
  return "으로";
}

// "이/가"
function getGa(str) {
  return hasBatchim(str) ? "이" : "가";
}

// itemSeq 마지막 읽는 소리 → 으로/로
// 숫자 마지막 자리를 한글로 변환
const NUM_KOREAN_LAST = { 0:"공", 1:"일", 2:"이", 3:"삼", 4:"사", 5:"오", 6:"육", 7:"칠", 8:"팔", 9:"구" };
// 받침 있는 숫자: 일(ㄹ), 삼(ㅁ), 육(ㄱ), 칠(ㄹ), 팔(ㄹ) → "로" or "으로"
// 받침 없는: 공, 이, 사, 오, 구 → "로"
function getSeqJosa(seq) {
  if (!seq) return "으로";
  const lastDigit = parseInt(seq[seq.length - 1]);
  // 일(1)→ㄹ→로, 칠(7)→ㄹ→로, 팔(8)→ㄹ→로
  if ([1, 7, 8].includes(lastDigit)) return "로";
  // 삼(3)→ㅁ→으로, 육(6)→ㄱ→으로
  if ([3, 6].includes(lastDigit)) return "으로";
  // 공(0),이(2),사(4),오(5),구(9) → 받침없음 → 로
  return "로";
}

// ── 2. 소스에서 정보 추출 ─────────────────────────────────────
function loadSource(slug) {
  const p = path.join(SOURCE_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function detectGroup(src) {
  const atp = src.atpnQesitm || "";
  if (atp.includes("대두유")) return "B";
  if (atp.includes("갈락토오스")) return "C";
  return "min";
}

function detectType(src) {
  const efcy = src.efcyQesitm || "";
  const ingr = (src.permitItemIngrName || "").toLowerCase();
  if (ingr.includes("dutasteride")) return "DUT";
  if (efcy.includes("전립") || efcy.includes("BPH")) return "BPH";
  if (efcy.includes("탈모") || efcy.includes("남성형") || efcy.includes("18 ~") || efcy.includes("18 ∼")) return "AGA";
  return "BPH"; // default for 5mg
}

function getYear(src) {
  if (src.permitDate && src.permitDate.length >= 4) return src.permitDate.substring(0, 4);
  if (src.itemSeq && src.itemSeq.length >= 4) return src.itemSeq.substring(0, 4);
  return "";
}

function getMg(src, slug) {
  // dutasteride
  if ((src.permitItemIngrName || "").toLowerCase().includes("dutasteride")) return "0.5mg";
  // from slug
  if (slug.includes("5mg")) return "5mg";
  if (slug.includes("1mg")) return "1mg";
  if (slug.includes("0.5mg")) return "0.5mg";
  // from efcy
  const efcy = src.efcyQesitm || "";
  if (efcy.includes("전립") || efcy.includes("BPH")) return "5mg";
  return "1mg";
}

function buildHeroDescription(slug, src) {
  const entpName = src.entpName || "";
  const seq = src.itemSeq || "";
  const year = getYear(src);
  const group = detectGroup(src);
  const type = detectType(src);
  const mg = getMg(src, slug);

  // nedrug-template (no entpName)
  const isNedrug = !entpName;

  // indication
  let indication = "";
  if (type === "AGA") {
    indication = "성인 남성(만 18~41세)의 남성형 탈모증(안드로겐 탈모증)";
  } else if (type === "DUT") {
    indication = "양성전립선비대증(BPH)";
  } else {
    indication = "양성전립선비대증(BPH)";
  }

  // 금기 text
  let geumsterm = "";
  if (group === "B") {
    if (type === "AGA") {
      geumsterm = "대두유·콩·땅콩 알레르기가 있으면 복용 금기이며, 갈락토오스 불내성 등 유당 대사 이상 환자도 금기예요. 간기능 이상 환자는 신중투여 대상이에요.";
    } else {
      geumsterm = "대두유·콩·땅콩 알레르기가 있으면 복용 금기이며, 갈락토오스 불내성, Lapp 유당분해효소 결핍증, 포도당-갈락토오스 흡수장애 등 유전적 유당 대사 이상 환자도 금기예요. 지방대사 이상 환자는 신중투여 대상이에요.";
    }
  } else if (group === "C") {
    if (type === "AGA") {
      geumsterm = "갈락토오스 불내성, Lapp 유당분해효소 결핍증, 포도당-갈락토오스 흡수장애 등 유전적 유당 대사 이상 환자는 복용 금기이며, 간기능 이상 환자는 신중투여 대상이에요.";
    } else {
      geumsterm = "갈락토오스 불내성, Lapp 유당분해효소 결핍증, 포도당-갈락토오스 흡수장애 등 유전적 유당 대사 이상 환자는 복용 금기이며, 간기능 이상 환자는 신중투여 대상이에요.";
    }
  } else { // minimal
    if (type === "AGA") {
      geumsterm = "BPH 등으로 피나스테리드 5mg 또는 다른 5α-환원효소 억제제(두타스테리드)를 이미 복용 중인 환자는 금기이며, 간기능 이상 환자는 신중투여 대상이에요.";
    } else if (type === "DUT") {
      geumsterm = "이 약 또는 구성성분에 과민반응 병력이 있으면 복용 금기이며, 간기능 이상 환자는 신중투여 대상이에요.";
    } else {
      geumsterm = "이 약 또는 구성성분에 과민반응 병력이 있으면 복용 금기이며, 간기능 이상 환자는 신중투여 대상이에요.";
    }
  }

  if (isNedrug) {
    // nedrug-template
    if (type === "AGA") {
      return `식약처 허가사항 기준 성인 남성(만 18~41세)의 남성형 탈모증(안드로겐 탈모증) 치료에 허가된 피나스테리드 ${mg} 정제예요. ${geumsterm}`;
    } else if (type === "DUT") {
      return `식약처 허가사항 기준 양성전립선비대증(BPH) 치료에 허가된 두타스테리드 ${mg} 연질캡슐이에요. ${geumsterm}`;
    } else {
      return `식약처 허가사항 기준 양성전립선비대증(BPH) 치료에 허가된 피나스테리드 ${mg} 정제예요. ${geumsterm}`;
    }
  }

  // regular source
  const ga = getGa(entpName);
  const seqJosa = getSeqJosa(seq);
  const medicine = type === "DUT" ? "두타스테리드" : "피나스테리드";
  const form = (slug.includes("연질") || slug.includes("캡슐")) ? "연질캡슐" : "정제";

  let hero = `${entpName}${ga} ${year}년 허가받은 ${medicine} ${mg} ${form}예요.`;
  if (seq) {
    hero += ` 품목번호 ${seq}${seqJosa} 식약처 허가사항 기준 ${indication} 치료에 허가된 전문의약품이에요.`;
  } else {
    hero += ` 식약처 허가사항 기준 ${indication} 치료에 허가된 전문의약품이에요.`;
  }
  hero += ` ${geumsterm}`;
  return hero;
}

// ── 3. title v3 생성 ──────────────────────────────────────────
function buildTitle(slug, src) {
  const entpName = src.entpName || "";
  const year = getYear(src);
  const type = detectType(src);
  const mg = getMg(src, slug);
  const productName = slug;

  if (type === "AGA") {
    if (entpName && year) {
      return `${productName} 효과·가격·부작용 | 피나스테리드 ${mg} 탈모 (${entpName} ${year})`;
    }
    return `${productName} 효과·가격·부작용 | 피나스테리드 ${mg} AGA 제네릭 복용법`;
  } else if (type === "DUT") {
    if (entpName && year) {
      return `${productName} 효과·가격·부작용 | 두타스테리드 ${mg} BPH (${entpName} ${year})`;
    }
    return `${productName} 효과·가격·부작용 | 두타스테리드 ${mg} BPH 제네릭 복용법`;
  } else { // BPH finasteride
    if (entpName && year) {
      return `${productName} 효과·가격·부작용 | 피나스테리드 ${mg} BPH (${entpName} ${year})`;
    }
    return `${productName} 효과·가격·부작용 | 피나스테리드 ${mg} BPH 제네릭 복용법`;
  }
}

// ── 4. metaDescription v3 생성 ───────────────────────────────
function buildMeta(slug, src) {
  const entpName = src.entpName || "";
  const seq = src.itemSeq || "";
  const type = detectType(src);
  const mg = getMg(src, slug);

  if (type === "AGA") {
    if (entpName && seq) {
      return `${slug}(피나스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. ${entpName} 제조, 품목번호 ${seq}, 탈모 치료 전문의약품.`;
    }
    return `${slug}(피나스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. 식약처 허가사항 기준 성인 남성(만 18~41세) 남성형 탈모증 치료 전문의약품.`;
  } else if (type === "DUT") {
    if (entpName && seq) {
      return `${slug}(두타스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. ${entpName} 제조, 품목번호 ${seq}, BPH 치료 전문의약품.`;
    }
    return `${slug}(두타스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. 식약처 허가사항 기준 양성전립선비대증(BPH) 치료 전문의약품.`;
  } else {
    if (entpName && seq) {
      return `${slug}(피나스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. ${entpName} 제조, 품목번호 ${seq}, BPH 치료 전문의약품.`;
    }
    return `${slug}(피나스테리드 ${mg}) 성분·효과·복용법·부작용을 정리했습니다. 식약처 허가사항 기준 양성전립선비대증(BPH) 치료 전문의약품.`;
  }
}

// ── 5. 전체 파일 내 텍스트 정리 (전역 패턴) ─────────────────
function applyGlobalCleanups(content) {
  // DHT % 수치 제거
  content = content.replace(/DHT를 약 65~70% 줄여줘요\./g, "DHT 생성을 억제해요.");
  content = content.replace(/혈중 DHT를 약 65~70% 줄여줘요\./g, "DHT 생성이 억제돼요.");
  content = content.replace(/DHT를 65~70% 낮춰요/g, "DHT 생성을 억제해요");
  content = content.replace(/DHT를 65~70% 감소시켜요/g, "DHT 생성을 억제해요");
  content = content.replace(/, DHT 65~70% 감소/g, ", DHT 생성 억제");
  content = content.replace(/"role":"5alpha-환원효소 2형 억제, DHT 65~70% 감소"/g, '"role":"5α-환원효소 2형 억제 → DHT 생성 억제"');
  content = content.replace(/"role":"5α-환원효소 2형 억제, DHT 65~70% 감소"/g, '"role":"5α-환원효소 2형 억제 → DHT 생성 억제"');
  content = content.replace(/5alpha-환원효소 2형 억제, DHT 65~70% 감소/g, "5α-환원효소 2형 억제 → DHT 생성 억제");

  // DHT 93% 수치 제거
  content = content.replace(/DHT 억제율이 더 높지만\(93% vs 65~70%\)/g, "DHT 억제 범위가 더 넓지만");
  content = content.replace(/\(65~70% vs 93%\)/g, "");
  content = content.replace(/DHT를 93% 억제하는/g, "DHT를 광범위하게 억제하는");

  // 초기탈락 제거
  content = content.replace(/복용 초기 1~2개월에 오히려 빠지는 것처럼 느껴질 수 있는데, 성장기로 전환되면서 기존 휴지기 모발이 밀려나는 정상 과정이에요. 이 시기를 버텨야 진짜 효과를 볼 수 있어요\./g, "");
  content = content.replace(/초기 1~2개월에는 일시적으로 탈모가 증가하는 것처럼 느껴질 수 있어요\.[^\\n]*/g, "");

  // 헌혈 제거
  content = content.replace(/헌혈은 복용 중단 후 최소 1개월 후에 가능해요\.\s*/g, "");
  content = content.replace(/헌혈은 중단 후 1개월 후에 가능해요\.\s*/g, "");
  content = content.replace(/헌혈은 복용을 중단한 후 1개월이 지난 뒤에만 가능해요\.\s*/g, "");

  // 미녹시딜 병용 FAQ 제거 → 중단 시나리오로 교체는 개별 처리가 어려워 flag만
  // (heroDescription과 다른 주요 섹션은 per-article로 처리)

  // 첨가제 ingredients 제거
  content = content.replace(/,\{"type":"첨가제","name":"[^"]+","role":"[^"]+"\}/g, "");
  content = content.replace(/\{"type":"첨가제","name":"[^"]+","role":"[^"]+"\},?/g, "");

  // "두타스테리드 캡슐와 달리 5alpha-환원효소 2형만 억제하지만, 부작용 발생률이 상대적으로 낮아서 1차 선택약으로 많이 쓰여요."
  content = content.replace(/두타스테리드 캡슐와 달리 5alpha-환원효소 2형만 억제하지만, 부작용 발생률이 상대적으로 낮아서 1차 선택약으로 많이 쓰여요\./g, "");

  // 5alpha → 5α 정규화
  content = content.replace(/5alpha-환원효소/g, "5α-환원효소");

  return content;
}

// ── 6. 개별 article 블록에서 heroDescription·title 교체 ───────
function rewriteArticleBlock(block, slug, src) {
  const newTitle = buildTitle(slug, src);
  const newHero = buildHeroDescription(slug, src);
  const newMeta = buildMeta(slug, src);

  // title
  block = block.replace(
    /title: ".*?",/,
    `title: "${newTitle}",`
  );
  // h1
  block = block.replace(
    /h1: ".*?",/,
    `h1: "${newTitle}",`
  );
  // metaDescription
  block = block.replace(
    /metaDescription: ".*?",/,
    `metaDescription: "${newMeta}",`
  );
  // heroDescription
  block = block.replace(
    /heroDescription: ".*?",/s,
    `heroDescription: "${newHero}",`
  );
  // dateModified
  block = block.replace(
    /dateModified: ".*?",/,
    `dateModified: "${TODAY}",`
  );

  return block;
}

// ── 7. 소스 유효성 검증 ───────────────────────────────────────
// 잘못된 소스 매핑 (소스 efcyQesitm이 탈모/전립선/두타스테리드와 무관)
const WRONG_SOURCE_KEYWORDS = ["습진", "피부염", "두드러기", "땀띠", "버거병", "혈전", "척추관협착", "당뇨", "폐색성"];

function isValidSource(src, slug) {
  const ingr = (src.permitItemIngrName || "").toLowerCase();
  const efcy = src.efcyQesitm || "";
  const atpn = src.atpnQesitm || "";

  // 잘못된 소스 감지
  for (const kw of WRONG_SOURCE_KEYWORDS) {
    if (efcy.includes(kw)) return false;
  }

  // 한국어/영어 성분명 확인
  if (ingr.includes("finasteride") || ingr.includes("dutasteride") || ingr.includes("minoxidil")) return true;
  if ((src.permitItemIngrName || "").includes("피나스테리드")) return true;
  if ((src.permitItemIngrName || "").includes("두타스테리드")) return true;
  if ((src.permitItemIngrName || "").includes("미녹시딜")) return true;

  // 성분명 없어도 efcyQesitm으로 판별
  if (efcy.includes("전립") || efcy.includes("BPH")) return true;
  if (efcy.includes("탈모") || efcy.includes("남성형")) return true;

  // 미녹시딜 외용제 (slug 패턴)
  if (/액[235]$|겔5$|액3$/.test(slug)) return true;

  return false;
}

// ── 8. 미녹시딜 외용제 처리 ───────────────────────────────────
function isMinoxidilTopical(slug) {
  return /액[235]$|겔[235]?$/.test(slug) || slug.includes("미녹시딜");
}

function getMinoxidilConc(slug, src) {
  if (slug.endsWith("액2") || slug.endsWith("겔2")) return "2%";
  if (slug.endsWith("액3") || slug.endsWith("겔3")) return "3%";
  if (slug.endsWith("액5") || slug.endsWith("겔5")) return "5%";
  if (slug.includes("2")) return "2%";
  if (slug.includes("5")) return "5%";
  if (slug.includes("3")) return "3%";
  // src.itemName fallback: "마이녹실액3%(미녹시딜)" → 3%
  if (src && src.itemName) {
    const m = src.itemName.match(/(\d+)\s*%/);
    if (m) return m[1] + "%";
  }
  return "";
}

function buildMinoxidilHero(slug, src) {
  const conc = getMinoxidilConc(slug, src);
  const entpName = src.entpName || "";
  const seq = src.itemSeq || "";
  const year = getYear(src);
  const efcy = src.efcyQesitm || "";
  const hasFemale = efcy.includes("여성형");

  if (entpName && seq && year) {
    const ga = getGa(entpName);
    const seqJosa = getSeqJosa(seq);
    const indication = hasFemale
      ? "성인의 남성형 및 여성형 탈모증"
      : "남성형 탈모증";
    return `${entpName}${ga} ${year}년 허가받은 미녹시딜 ${conc} 두피 도포용 외용액이에요. 품목번호 ${seq}${seqJosa} 식약처 허가사항 기준 ${indication} 치료에 허가된 전문의약품이에요. 두피에 직접 도포해 모낭 혈류를 개선하는 외용제로, 경구 피나스테리드와 달리 여성도 사용 가능한 농도가 있어요.`;
  }
  // nedrug-template
  const indication = hasFemale ? "남성형·여성형 탈모증" : "남성형 탈모증";
  return `미녹시딜 ${conc} 두피 도포용 외용액으로, 식약처 허가사항 기준 성인의 ${indication} 치료에 허가된 전문의약품이에요. 두피에 직접 도포해 모낭 주변 혈류를 개선하는 방식이에요.`;
}

function buildMinoxidilTitle(slug, src) {
  const conc = getMinoxidilConc(slug, src);
  const entpName = src.entpName || "";
  const year = getYear(src);
  if (entpName && year) {
    return `${slug} 효과·가격·부작용 | 미녹시딜 ${conc} 외용액 사용법 (${entpName} ${year})`;
  }
  return `${slug} 효과·가격·부작용 | 미녹시딜 ${conc} 탈모 외용액 사용법`;
}

function buildMinoxidilMeta(slug, src) {
  const conc = getMinoxidilConc(slug, src);
  const entpName = src.entpName || "";
  const seq = src.itemSeq || "";
  if (entpName && seq) {
    return `${slug}(미녹시딜 ${conc}) 성분·효과·사용법·부작용을 정리했습니다. ${entpName} 제조, 품목번호 ${seq}, 탈모 외용제.`;
  }
  return `${slug}(미녹시딜 ${conc}) 성분·효과·두피 사용법·부작용을 정리했습니다. 식약처 허가사항 기준 남성형 탈모증 치료 외용제.`;
}

function rewriteMinoxidilBlock(block, slug, src) {
  const newTitle = buildMinoxidilTitle(slug, src);
  const newHero = buildMinoxidilHero(slug, src);
  const newMeta = buildMinoxidilMeta(slug, src);

  block = block.replace(/title: ".*?",/, `title: "${newTitle}",`);
  block = block.replace(/h1: ".*?",/, `h1: "${newTitle}",`);
  block = block.replace(/metaDescription: ".*?",/, `metaDescription: "${newMeta}",`);
  block = block.replace(/heroDescription: ".*?",/s, `heroDescription: "${newHero}",`);
  block = block.replace(/dateModified: ".*?",/, `dateModified: "${TODAY}",`);
  return block;
}

// ── 9. 파일 처리 ─────────────────────────────────────────────
function processFile(filename) {
  const filePath = path.join(ARTICLES_DIR, filename);
  let content = fs.readFileSync(filePath, "utf8");
  let count = 0;

  // 전역 정리 먼저
  content = applyGlobalCleanups(content);

  // 각 article 블록 처리 (따옴표 있는 "slug": { 와 없는 slug: { 모두 처리)
  const articleRegex = /"?([가-힣a-zA-Z0-9%._-]+)"?\s*:\s*\{[\s\S]*?(?=\s+"?[가-힣a-zA-Z0-9%._-]+"?\s*:\s*\{|\s*\};)/g;

  const newContent = content.replace(articleRegex, (match, slug) => {
    if (match.includes(`dateModified: "${TODAY}"`)) return match;
    // 이미 v3 완료(heroDescription에 품목번호 있음) → 스킵
    const heroMatch = match.match(/heroDescription:\s*"([\s\S]*?)(?<!\\)",/);
    if (heroMatch && heroMatch[1].includes('품목번호')) return match;

    const src = loadSource(slug);
    if (!src) {
      console.log(`  SKIP (no source): ${slug}`);
      return match;
    }

    if (!isValidSource(src, slug)) {
      console.log(`  SKIP (wrong source: ${src.efcyQesitm?.substring(0,30)}): ${slug}`);
      return match;
    }

    let updated;
    if (isMinoxidilTopical(slug)) {
      updated = rewriteMinoxidilBlock(match, slug, src);
    } else {
      updated = rewriteArticleBlock(match, slug, src);
    }
    count++;
    console.log(`  OK: ${slug}`);
    return updated;
  });

  fs.writeFileSync(filePath, newContent, "utf8");
  console.log(`\n[${filename}] 처리 완료: ${count}개`);
  return count;
}

// ── 8. 실행 ──────────────────────────────────────────────────
// 실행 시 파일 인자 받기: node scripts/rewrite-talmo-v3.js 탈모-3.ts
const targetArg = process.argv[2];
const defaultTargets = ["탈모-4.ts", "탈모-5.ts"];
const targets = targetArg ? [path.basename(targetArg)] : defaultTargets;

console.log("탈모 v3 일괄 리라이트 시작...\n");
let total = 0;
for (const t of targets) total += processFile(t);
console.log(`\n총 ${total}개 완료`);
