/**
 * Pre-Edit Hook: articles 파일 수정 시 소스 JSON 대조
 *
 * 동작:
 * 1. data/articles/*.ts 파일이 아니면 → 통과
 * 2. 새로 작성/수정되는 spoke 블록에서 slug 추출
 * 3. source-data/{slug}.json Read 여부 확인 (tmp/.source-reads.json 로그)
 * 4. Read 안 했으면 exit 2 → "먼저 source-data/{slug}.json을 Read하세요"
 * 5. 핵심 숫자(연령, 용법, 성분량) 소스와 대조
 * 6. 불일치 시 exit 2 → Claude Code에 피드백 + 차단
 *
 * 환경: STDIN_JSON으로 tool_input 받음
 * 연계: track-source-read.js (PostToolUse Read)가 로그 기록
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_DIR = path.join(PROJECT_ROOT, "source-data");
const SOURCE_MAP = path.join(SOURCE_DIR, "source-map.json");
const SOURCE_READS_LOG = path.join(PROJECT_ROOT, "tmp", ".source-reads.json");
const ARTICLES_DIR = path.join(PROJECT_ROOT, "data", "articles");
const READ_TTL_MS = 30 * 60 * 1000; // 30분

// ========== heroDescription 게이트 ==========

// 템플릿 패턴 (이 패턴으로 시작하면 차단)
const HERO_BANNED_PATTERNS = [
  /^\d+(캡슐|포|정|일)\s*\(/,                    // "1캡슐(300mg)에..."
  /^\d+\s*(캡슐|포|정)\s*\(/,                    // "1 캡슐(300mg)에..."
  /^프로바이오틱스\s*\d+억/,                      // "프로바이오틱스 100억..."
  /^\d+억\s*CFU/,                                // "100억 CFU..."
];

// 같은 카테고리의 기존 heroDescription 목록 로드
function loadExistingHeroDescriptions(categorySlug) {
  const heroes = [];
  try {
    const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith(".ts") && !f.endsWith("index.ts"));
    for (const file of files) {
      const filePath = path.join(ARTICLES_DIR, file);
      const content = fs.readFileSync(filePath, "utf8");
      // 카테고리 매칭: 이 파일이 해당 카테고리인지 확인
      if (categorySlug && !content.includes(`categorySlug: "${categorySlug}"`)) continue;
      // heroDescription 추출 (spoke 블록에서만 = sections: 가 있는 블록)
      const regex = /heroDescription:\s*"([^"]+)"/g;
      let m;
      while ((m = regex.exec(content)) !== null) {
        heroes.push(m[1]);
      }
    }
  } catch {}
  return heroes;
}

// 단어 토큰화 (한글+영문+숫자 단위)
function tokenize(text) {
  return (text.match(/[가-힣]+|[a-zA-Z]+|\d+/g) || []).map(t => t.toLowerCase());
}

// 단어 겹침 비율
function wordOverlap(a, b) {
  const tokA = new Set(tokenize(a));
  const tokB = new Set(tokenize(b));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokA) { if (tokB.has(t)) overlap++; }
  return overlap / Math.min(tokA.size, tokB.size);
}

// heroDescription 검증
function validateHeroDescription(slug, heroDesc, categorySlug) {
  const errors = [];

  // 게이트 1: heroDescription이 비어있으면 차단
  if (!heroDesc || heroDesc.trim().length < 20) {
    errors.push(`[${slug}] heroDescription 없음 또는 너무 짧음 (20자 이상 필수). 서론을 먼저 작성하세요.`);
    return errors;
  }

  // 게이트 2: 금지 템플릿 패턴 차단
  for (const pattern of HERO_BANNED_PATTERNS) {
    if (pattern.test(heroDesc.trim())) {
      errors.push(`[${slug}] heroDescription이 스펙나열 템플릿이에요: "${heroDesc.substring(0, 40)}..." → 독자 상황(Q1)부터 시작하세요. "N캡슐에 N억 CFU" 같은 시작 금지.`);
      return errors;
    }
  }

  // 게이트 3: 기존 글과 첫 15자 겹침 차단
  const existingHeroes = loadExistingHeroDescriptions(categorySlug);
  const newFirst15 = heroDesc.trim().substring(0, 15);
  for (const existing of existingHeroes) {
    if (existing.trim().substring(0, 15) === newFirst15 && existing !== heroDesc) {
      errors.push(`[${slug}] heroDescription 첫 15자가 기존 글과 동일: "${newFirst15}..." → 서론 첫 문장을 다르게 쓰세요.`);
      return errors;
    }
  }

  // 게이트 4: 기존 글과 단어 70% 이상 겹침 차단
  for (const existing of existingHeroes) {
    if (existing === heroDesc) continue; // 자기 자신 skip
    const overlap = wordOverlap(heroDesc, existing);
    if (overlap >= 0.7) {
      errors.push(`[${slug}] heroDescription이 기존 글과 ${Math.round(overlap*100)}% 단어 겹침: "${existing.substring(0, 40)}..." → 서론을 다시 쓰세요.`);
      return errors;
    }
  }

  return errors;
}

// 소스 JSON Read 로그 로드
function getSourceReadsLog() {
  try {
    const log = JSON.parse(fs.readFileSync(SOURCE_READS_LOG, "utf8"));
    const now = Date.now();
    // TTL 지난 항목 제거
    const valid = {};
    for (const [key, ts] of Object.entries(log)) {
      if (now - ts <= READ_TTL_MS) valid[key] = ts;
    }
    return valid;
  } catch {
    return {};
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(process.env.STDIN_JSON || "{}");
  } catch {
    process.exit(0); // JSON 파싱 실패 → 통과
  }

  const filePath = input.tool_input?.file_path || input.tool_input?.filePath || "";

  // articles 파일이 아니면 통과
  if (!filePath.includes("data/articles/") && !filePath.includes("data\\articles\\")) {
    process.exit(0);
  }
  if (!filePath.endsWith(".ts")) {
    process.exit(0);
  }
  // index.ts는 통과
  if (filePath.endsWith("index.ts")) {
    process.exit(0);
  }

  // 소스맵 로드
  if (!fs.existsSync(SOURCE_MAP)) {
    process.exit(0); // 소스맵 없으면 통과
  }

  let sourceMap;
  try {
    sourceMap = JSON.parse(fs.readFileSync(SOURCE_MAP, "utf8"));
  } catch {
    process.exit(0);
  }

  // 새 내용에서 slug + content 추출
  const content = input.tool_input?.content || input.tool_input?.new_string || "";
  if (!content || content.length < 50) {
    process.exit(0); // 내용이 너무 짧으면 통과 (부분 수정)
  }

  // slug 추출
  const slugMatches = [...content.matchAll(/slug:\s*"([^"]+)"/g)];
  if (slugMatches.length === 0) {
    process.exit(0); // slug 없으면 통과
  }

  const errors = [];

  for (const match of slugMatches) {
    const slug = match[1];
    const entry = sourceMap[slug];

    // 이 slug 이후 ~ 다음 slug 전까지의 블록 추출
    const slugIdx = content.indexOf(match[0]);
    const nextSlugMatch = content.indexOf('slug: "', slugIdx + match[0].length);
    const block = nextSlugMatch > 0
      ? content.substring(slugIdx, nextSlugMatch)
      : content.substring(slugIdx, Math.min(slugIdx + 15000, content.length));

    // === heroDescription 게이트 (서론 통과 못하면 본문 진입 불가) ===
    const hasSpokeContent = (block.includes("content:") || block.includes("sections:")) && block.length > 200;
    if (hasSpokeContent) {
      const heroMatch = block.match(/heroDescription:\s*"([^"]*)"/);
      const heroDesc = heroMatch ? heroMatch[1] : "";
      const catMatch = block.match(/categorySlug:\s*"([^"]*)"/);
      const categorySlug = catMatch ? catMatch[1] : "";

      const heroErrors = validateHeroDescription(slug, heroDesc, categorySlug);
      if (heroErrors.length > 0) {
        errors.push(...heroErrors);
        errors.push(`[${slug}] ⛔ 서론(heroDescription) 검증 실패 → 본문(sections) 작성 차단. 서론부터 다시 쓰세요.`);
        continue; // 서론 실패하면 나머지 검사 skip
      }
    }

    // === 분량 검사 (소스 유무 관계없이 항상 실행) ===

    // 0. 섹션별 최소 3문단 검사
    const sectionMatches = [...block.matchAll(/title:\s*"([^"]+)"[\s\S]*?content:\s*"((?:[^"\\]|\\.)*)"/g)];
    for (const secMatch of sectionMatches) {
      const secTitle = secMatch[1];
      const secContent = secMatch[2];
      const paraCount = secContent.split("\\n\\n").filter(p => p.trim()).length;
      if (paraCount < 3 && secContent.length > 30) {
        errors.push(`[${slug}] "${secTitle}" 섹션 ${paraCount}문단 — 최소 3문단 필요 (\\n\\n으로 구분)`);
      }
    }

    // === 문체 검사 (소스 유무 관계없이 항상 실행) ===

    // 5. 문체 검사 (문어체 금지)
    const forbiddenEndings = ["합니다", "입니다", "됩니다", "었습니다", "있습니다"];
    for (const ending of forbiddenEndings) {
      const re = new RegExp(ending + "[.!?]", "g");
      const matches2 = block.match(re) || [];
      if (matches2.length > 0) {
        const metaBlock = block.match(/metaDescription:\s*"[^"]*"/)?.[0] || "";
        const nonMetaContent = block.replace(metaBlock, "");
        const nonMetaMatches = nonMetaContent.match(re) || [];
        if (nonMetaMatches.length > 0) {
          errors.push(`[${slug}] 문어체 감지: "${ending}" ${nonMetaMatches.length}건 (구어체 "~해요" 사용 필수)`);
        }
      }
    }

    // === 소스 JSON Read 여부 확인 (핵심 게이트) ===
    const hasContent = (block.includes("content:") || block.includes("sections:")) && block.length > 200;

    if (hasContent) {
      const readLog = getSourceReadsLog();
      const wasRead = !!readLog[slug];

      if (!wasRead) {
        // 소스 파일 존재 여부 확인
        const sourceExists = entry?.sourceFile && fs.existsSync(path.join(SOURCE_DIR, entry.sourceFile));
        if (sourceExists) {
          errors.push(`[${slug}] 소스 JSON을 먼저 Read하세요! 글 작성 전에 반드시 source-data/${slug}.json을 읽어야 해요. (Read tool로 source-data/${slug}.json 열기)`);
        } else {
          errors.push(`[${slug}] 소스 JSON 없이 글 작성 금지. 먼저 source-data/${slug}.json을 수집하세요. (node scripts/fetch-source.js --slug ${slug})`);
        }
        continue;
      }
    }

    // 소스 JSON 로드 — 팩트 대조용
    let sourceData = null;
    if (entry && entry.sourceFile) {
      const sourceFile = path.join(SOURCE_DIR, entry.sourceFile);
      if (fs.existsSync(sourceFile)) {
        try {
          sourceData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
        } catch {}
      }
    }
    if (!sourceData) {
      continue; // 소스 없으면 위에서 이미 차단됨
    }

    // === 팩트 대조 (소스 있는 경우만) ===

    // 1. 연령제한 대조
    const sourceAllText = [
      sourceData.useMethodQesitm,
      sourceData.atpnQesitm,
      sourceData.atpnWarnQesitm,
    ].filter(Boolean).join(" ");

    const srcAgeMatch = sourceAllText.match(/만\s*(\d+)\s*세\s*(이상|이하|미만|초과)/);
    const artAgeMatches = [...block.matchAll(/만\s*(\d+)\s*세\s*(이상|이하|미만|초과)/g)];

    if (srcAgeMatch && artAgeMatches.length > 0) {
      const srcAge = parseInt(srcAgeMatch[1]);
      for (const artAge of artAgeMatches) {
        const artAgeNum = parseInt(artAge[1]);
        if (artAgeNum !== srcAge) {
          errors.push(`[${slug}] 연령제한 불일치: 글="만 ${artAgeNum}세" vs 소스="만 ${srcAge}세"`);
        }
      }
    }

    // 2. 용법 횟수 대조 (1일 N회, 1일 N~M회 범위 포함)
    const srcDailyMatch = sourceAllText.match(/1일\s*(\d+)(?:\s*~\s*(\d+))?\s*회/);
    const artDailyMatches = [...block.matchAll(/1일\s*(\d+)(?:\s*~\s*(\d+))?\s*회/g)];

    if (srcDailyMatch && artDailyMatches.length > 0) {
      const srcMin = parseInt(srcDailyMatch[1]);
      const srcMax = srcDailyMatch[2] ? parseInt(srcDailyMatch[2]) : srcMin;
      for (const artDaily of artDailyMatches) {
        const artMin = parseInt(artDaily[1]);
        const artMax = artDaily[2] ? parseInt(artDaily[2]) : artMin;
        // 글의 범위가 소스 범위를 벗어나면 오류
        if (artMin < srcMin || artMax > srcMax) {
          errors.push(`[${slug}] 용법 불일치: 글="1일 ${artMin}${artMax !== artMin ? '~'+artMax : ''}회" vs 소스="1일 ${srcMin}${srcMax !== srcMin ? '~'+srcMax : ''}회"`);
        }
      }
    }

    // 3. 1회 용량 대조 (1회 N~M정 범위 포함)
    const srcPerTimeMatch = sourceAllText.match(/1회\s*(\d+)(?:\s*~\s*(\d+))?\s*(정|캡슐|포|mL|밀리리터)/);
    const artPerTimeMatches = [...block.matchAll(/1회\s*(\d+)(?:\s*~\s*(\d+))?\s*(정|캡슐|포|mL|밀리리터)/g)];

    if (srcPerTimeMatch && artPerTimeMatches.length > 0) {
      const srcMin = parseInt(srcPerTimeMatch[1]);
      const srcMax = srcPerTimeMatch[2] ? parseInt(srcPerTimeMatch[2]) : srcMin;
      for (const artPerTime of artPerTimeMatches) {
        const artNum = parseInt(artPerTime[1]);
        if (artNum < srcMin || artNum > srcMax) {
          errors.push(`[${slug}] 1회 용량 불일치: 글="${artNum}${artPerTime[3]}" vs 소스="${srcMin}${srcMax !== srcMin ? '~'+srcMax : ''}${srcPerTimeMatch[3]}"`);
        }
      }
    }

    // 4. 맥락 반전 감지 (금지 ↔ 가능)
    const sourceHasContra = /복용하지\s*마|복용\s*금지|사용하지\s*마|사용\s*금지/.test(sourceAllText);
    const artHasAllow = /복용해도\s*(?:돼|괜찮)|복용\s*가능|사용해도\s*(?:돼|괜찮)/.test(block);

    if (sourceHasContra && artHasAllow) {
      const artHasContra = /복용하지\s*마|복용\s*금지|사용하지\s*마|사용\s*금지/.test(block);
      if (!artHasContra) {
        errors.push(`[${slug}] 맥락 반전 의심: 소스에 "금지" 있지만 글에는 "가능"만 있음`);
      }
    }

  }

  if (errors.length > 0) {
    console.error("=== pharm-jjyu 소스 대조 훅: 불일치 감지 ===");
    for (const err of errors) {
      console.error("  " + err);
    }
    console.error("\n소스 데이터(source-data/*.json)를 확인하고 수정 후 다시 작성하세요.");
    console.error("소스 확인: node scripts/verify-all.js --slug {슬러그명}");
    process.exit(2); // exit 2 = Claude Code에 피드백 전달 + 차단
  }

  // 모든 검증 통과
  process.exit(0);
}

main();
