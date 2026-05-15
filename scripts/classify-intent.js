/**
 * classify-intent.js
 *
 * source-data + 카테고리 내 spoke 분석으로 searchIntent + differentiationAnchor 결정.
 * brief.json 생성 (writer 입력).
 *
 * 사용법:
 *   node scripts/classify-intent.js {slug}
 *
 * 출력:
 *   _workspace/{slug}-brief.json
 *
 * 사전 조건:
 *   _workspace/{slug}-facts.json 존재 (build-facts-whitelist.js 먼저)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");
const WORKSPACE_DIR = path.resolve(__dirname, "..", "_workspace");
const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");

// 활성 성분 매핑 (확장 가능)
const INGREDIENT_GROUPS = {
  minoxidil: { pattern: /미녹시딜|minoxidil|마이녹실|로게인|그루녹시딜|나녹시딜|키랜드/i, label: "미녹시딜" },
  finasteride: { pattern: /피나스테리드|finasteride|프로페시아|피나원|피나스테|아스테리|페시아|헤어그로/i, label: "피나스테리드" },
  dutasteride: { pattern: /두타스테리드|dutasteride|아보다트|두테리드/i, label: "두타스테리드" },
  acetaminophen: { pattern: /아세트아미노펜|acetaminophen|타이레놀|판콜|판피린|써스펜|챔프/i, label: "아세트아미노펜" },
  ibuprofen: { pattern: /이부프로펜|ibuprofen|부루펜|애드빌/i, label: "이부프로펜" },
  diclofenac: { pattern: /디클로페낙|diclofenac|볼타렌/i, label: "디클로페낙" },
  cetirizine: { pattern: /세티리진|cetirizine|지르텍/i, label: "세티리진" },
  loratadine: { pattern: /로라타딘|loratadine|클라리틴/i, label: "로라타딘" },
};

function resolveIngredientGroup(facts) {
  const haystack = `${facts.itemName || ""} ${facts.efcyQesitm || ""}`;
  for (const [key, def] of Object.entries(INGREDIENT_GROUPS)) {
    if (def.pattern.test(haystack)) return { key, label: def.label };
  }
  return { key: "uncategorized", label: facts.itemName || facts.slug };
}

function findSameGroupSpokes(category, ingredientGroup, excludeSlug) {
  const groupDef = INGREDIENT_GROUPS[ingredientGroup];
  if (!groupDef) return [];

  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".ts") && f.replace(/-\d+$/, "").replace(".ts", "") === category);

  const matches = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, f), "utf8");
    const slugMatches = [...content.matchAll(/slug:\s*"([^"]+)"/g)];
    for (const sm of slugMatches) {
      const slug = sm[1];
      if (slug === excludeSlug) continue;
      if (groupDef.pattern.test(slug)) {
        // intent·anchor 추출 (있으면)
        const after = content.substring(sm.index, sm.index + 3000);
        const intentMatch = after.match(/searchIntent:\s*"([A-F])"/);
        const anchorMatch = after.match(/differentiationAnchor:\s*"([^"]+)"/);
        matches.push({
          slug,
          file: f,
          searchIntent: intentMatch ? intentMatch[1] : null,
          differentiationAnchor: anchorMatch ? anchorMatch[1] : null,
        });
        if (matches.length >= 10) return matches;
      }
    }
  }
  return matches;
}

function extractForbiddenSentences(category, sameGroupSpokes) {
  const sentences = [];
  for (const sp of sameGroupSpokes.slice(0, 5)) {
    const filePath = path.join(ARTICLES_DIR, sp.file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    const idx = content.indexOf(`slug: "${sp.slug}"`);
    if (idx === -1) continue;
    const block = content.substring(idx, idx + 8000);
    const contentMatches = [...block.matchAll(/content:\s*"([^"]{100,500})"/g)];
    contentMatches.slice(0, 2).forEach((m) => sentences.push(m[1].substring(0, 300)));
  }
  return sentences;
}

function decideIntent(facts, occupied) {
  const occupiedCombos = new Set(
    occupied.filter((o) => o.searchIntent && o.differentiationAnchor).map((o) => `${o.searchIntent}:${o.differentiationAnchor}`)
  );

  const slug = facts.slug;
  // 1) slug에 단서가 있으면 우선
  if (/비교|차이|vs/i.test(slug)) return { intent: "E", reason: "slug에 비교 단서" };
  if (/대안|단종|대체/i.test(slug)) return { intent: "F", reason: "slug에 대안 단서" };
  if (/가격|최저가/i.test(slug)) return { intent: "D", reason: "slug에 가격 단서" };
  if (/효과/i.test(slug)) return { intent: "A", reason: "slug에 효과 단서" };
  if (/부작용/i.test(slug)) return { intent: "B", reason: "slug에 부작용 단서" };
  if (/복용법|사용법|용법/i.test(slug)) return { intent: "C", reason: "slug에 용법 단서" };

  // 2) priceData 있으면 D형 우선 후보 (occupied 회피)
  const targetRatios = { A: 0.25, B: 0.2, C: 0.15, D: 0.25, E: 0.1, F: 0.05 };
  const counts = occupied.reduce((acc, o) => {
    if (o.searchIntent) acc[o.searchIntent] = (acc[o.searchIntent] || 0) + 1;
    return acc;
  }, {});
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const deficits = Object.entries(targetRatios).map(([k, ratio]) => ({
    intent: k,
    deficit: ratio - (counts[k] || 0) / total,
  }));
  deficits.sort((a, b) => b.deficit - a.deficit);

  // priceData 없으면 D 제외
  const candidates = deficits.filter((d) => (facts.priceData || d.intent !== "D"));
  return { intent: candidates[0].intent, reason: `카테고리 분배 균형 (deficit=${candidates[0].deficit.toFixed(2)})` };
}

function decideAnchor(facts, intent, occupied) {
  const occupiedAnchors = new Set(
    occupied.filter((o) => o.searchIntent === intent && o.differentiationAnchor).map((o) => o.differentiationAnchor)
  );
  const candidates = ["form", "dose", "age", "gender", "timing", "comorbidity", "priceTier", "prescription"];

  // 매우 단순한 휴리스틱: source.itemName에서 단서 추출
  const name = (facts.itemName || "").toLowerCase();
  if (/액|폼|겔|크림|연고|패치/.test(name)) {
    if (!occupiedAnchors.has("form")) return "form";
  }
  if (/\d+%|\d+mg/.test(name)) {
    if (!occupiedAnchors.has("dose")) return "dose";
  }
  if (/소아|어린이|키즈/.test(name)) {
    if (!occupiedAnchors.has("age")) return "age";
  }
  if (/여성|레이디/.test(name)) {
    if (!occupiedAnchors.has("gender")) return "gender";
  }

  // 점령 안된 첫 anchor
  for (const c of candidates) {
    if (!occupiedAnchors.has(c)) return c;
  }
  return candidates[0]; // fallback
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node classify-intent.js {slug}");
    process.exit(1);
  }

  // facts.json 자동 생성 (없으면)
  const factsFile = path.join(WORKSPACE_DIR, `${slug}-facts.json`);
  if (!fs.existsSync(factsFile)) {
    console.log(`facts.json 없음. build-facts-whitelist.js 자동 실행...`);
    execSync(`node "${path.join(__dirname, "build-facts-whitelist.js")}" ${slug}`, { stdio: "inherit" });
  }

  const facts = JSON.parse(fs.readFileSync(factsFile, "utf8"));

  // ingredient group
  const group = resolveIngredientGroup(facts);

  // 같은 group 다른 spoke
  const sameGroup = findSameGroupSpokes(facts.category, group.key, slug);

  // intent + anchor
  const { intent, reason } = decideIntent(facts, sameGroup);
  const anchor = decideAnchor(facts, intent, sameGroup);

  // forbidden sentences
  const forbiddenSentences = extractForbiddenSentences(facts.category, sameGroup);

  const brief = {
    slug,
    category: facts.category,
    searchIntent: intent,
    differentiationAnchor: anchor,
    ingredientGroup: group.key,
    ingredientGroupLabel: group.label,
    intentReason: reason,
    categoryOccupiedIntents: sameGroup.map((s) => ({
      slug: s.slug,
      searchIntent: s.searchIntent,
      differentiationAnchor: s.differentiationAnchor,
    })),
    facts,
    forbiddenSentences,
    templateFile: `.claude/templates/intent-${intent}.template.md`,
  };

  const outFile = path.join(WORKSPACE_DIR, `${slug}-brief.json`);
  fs.writeFileSync(outFile, JSON.stringify(brief, null, 2), "utf8");

  console.log(`brief.json 생성: ${outFile}`);
  console.log(`  searchIntent: ${intent} (${reason})`);
  console.log(`  anchor: ${anchor}`);
  console.log(`  ingredientGroup: ${group.key} (${group.label})`);
  console.log(`  같은 그룹 spoke ${sameGroup.length}개, forbiddenSentences ${forbiddenSentences.length}개`);
  console.log(`  template: ${brief.templateFile}`);
}

main();
