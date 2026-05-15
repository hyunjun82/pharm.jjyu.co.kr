#!/usr/bin/env node
/**
 * heroDescription 품질 진단 스크립트
 *
 * 문제 패턴을 감지하고 리라이트 대상을 분류한다.
 *
 * Usage:
 *   node scripts/audit-hero.js                    전체 진단
 *   node scripts/audit-hero.js --category 탈모     카테고리별
 *   node scripts/audit-hero.js --summary           요약만
 */

const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.resolve(__dirname, "..", "data", "articles");
const SOURCE_DIR = path.resolve(__dirname, "..", "source-data");

// ── 문제 패턴 정의 ──────────────────────────────────────────────
const BAD_PATTERNS = [
  { id: "MECH_QUESTION", desc: "기계적 질문 (~하셨나요?/~하시죠?)", regex: /(으셨나요|셨나요|시죠)\?/ },
  { id: "EMOTIONAL_OPEN", desc: "뻔한 감성 도입", regex: /^(거울 속|요즘 들어|혹시 |최근 들어|어느 날)/ },
  { id: "FILLER_OPEN", desc: "필러 도입 (알아보/살펴보)", regex: /(알아보|살펴보|함께 알아)/ },
  { id: "FORMAL_ENDING", desc: "문어체 (~합니다/~입니다)", regex: /(합니다|입니다|됩니다|봅니다)/ },
  { id: "NO_SOURCE_FACT", desc: "소스 팩트 부재 (숫자/용량/기간 없음)", regex: null }, // 별도 체크
  { id: "TOO_SHORT", desc: "80자 미만", regex: null },
  { id: "TOO_LONG", desc: "150자 초과", regex: null },
  { id: "DUPLICATE_START", desc: "같은 카테고리 내 첫 5자 중복", regex: null },
];

// ── spoke 블록에서 heroDescription 추출 ─────────────────────────
function extractHeroes(content) {
  const results = [];
  // slug와 heroDescription 매칭
  const spokePattern = /(?:"([^"]+)"|([가-힣\w]+))\s*:\s*\{/g;
  const heroPattern = /heroDescription\s*:\s*"((?:[^"\\]|\\.)*)"/g;

  // 더 정확한 방법: 각 spoke 블록에서 slug와 heroDescription 추출
  const lines = content.split("\n");
  let currentSlug = null;

  for (let i = 0; i < lines.length; i++) {
    const slugMatch = lines[i].match(/^\s{2,6}(?:"([^"]+)"|([가-힣A-Za-z0-9]+))\s*:\s*\{/);
    if (slugMatch) {
      currentSlug = slugMatch[1] || slugMatch[2];
    }

    const heroMatch = lines[i].match(/heroDescription\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (heroMatch && currentSlug) {
      results.push({ slug: currentSlug, hero: heroMatch[1] });
    }
  }

  return results;
}

// ── 소스 JSON에서 숫자 팩트 존재 확인 ─────────────────────────
function hasSourceFact(hero) {
  // 숫자, mg, ml, %, 세, 개월, 일, 회 등이 있으면 팩트 포함으로 판단
  return /\d+/.test(hero);
}

// ── 진단 실행 ───────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const categoryFilter = args.includes("--category")
    ? args[args.indexOf("--category") + 1]
    : null;
  const summaryOnly = args.includes("--summary");

  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith(".ts") && !f.endsWith(".bak") && f !== "index.ts" && f !== "build-all.ts")
    .filter(f => !categoryFilter || f.startsWith(categoryFilter));

  let totalSpokes = 0;
  let totalProblems = 0;
  const categoryStats = {};
  const allIssues = [];
  const herosByCategory = {}; // 중복 체크용

  for (const file of files) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
    const heroes = extractHeroes(content);

    // 카테고리 추출 (파일명에서 -N.ts 제거)
    const category = file.replace(/(-\d+)?\.ts$/, "");

    if (!herosByCategory[category]) herosByCategory[category] = [];
    if (!categoryStats[category]) categoryStats[category] = { total: 0, problems: 0, issues: {} };

    for (const { slug, hero } of heroes) {
      totalSpokes++;
      categoryStats[category].total++;

      const issues = [];

      // 패턴 체크
      for (const pattern of BAD_PATTERNS) {
        if (pattern.regex && pattern.regex.test(hero)) {
          issues.push(pattern.id);
        }
      }

      // 소스 팩트 부재 체크
      if (!hasSourceFact(hero)) {
        issues.push("NO_SOURCE_FACT");
      }

      // 글자수 체크
      if (hero.length < 80) {
        issues.push("TOO_SHORT");
      }
      if (hero.length > 150) {
        issues.push("TOO_LONG");
      }

      // 중복 시작 체크
      const first5 = hero.substring(0, 5);
      const dupCount = herosByCategory[category].filter(h => h.startsWith(first5)).length;
      if (dupCount >= 2) {
        issues.push("DUPLICATE_START");
      }

      herosByCategory[category].push(hero);

      if (issues.length > 0) {
        totalProblems++;
        categoryStats[category].problems++;
        for (const issue of issues) {
          categoryStats[category].issues[issue] = (categoryStats[category].issues[issue] || 0) + 1;
        }
        allIssues.push({ file, slug, hero: hero.substring(0, 40) + "...", issues });
      }
    }
  }

  // ── 출력 ──────────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("  heroDescription 품질 진단 결과");
  console.log("=".repeat(60));
  console.log(`\n총 spoke: ${totalSpokes}`);
  console.log(`문제 있음: ${totalProblems} (${(totalProblems/totalSpokes*100).toFixed(1)}%)`);
  console.log(`정상: ${totalSpokes - totalProblems} (${((totalSpokes-totalProblems)/totalSpokes*100).toFixed(1)}%)`);

  // 문제 유형별 통계
  console.log("\n── 문제 유형별 통계 ──");
  const globalIssues = {};
  for (const cat of Object.values(categoryStats)) {
    for (const [issue, count] of Object.entries(cat.issues)) {
      globalIssues[issue] = (globalIssues[issue] || 0) + count;
    }
  }
  const patternMap = {};
  BAD_PATTERNS.forEach(p => patternMap[p.id] = p.desc);
  for (const [issue, count] of Object.entries(globalIssues).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${patternMap[issue] || issue}: ${count}개`);
  }

  // 카테고리별 통계
  console.log("\n── 카테고리별 ──");
  for (const [cat, stats] of Object.entries(categoryStats).sort((a, b) => b[1].problems - a[1].problems)) {
    if (stats.problems > 0) {
      console.log(`  ${cat}: ${stats.problems}/${stats.total} 문제 (${(stats.problems/stats.total*100).toFixed(0)}%)`);
    }
  }

  // 상세 (summary 아닌 경우)
  if (!summaryOnly && allIssues.length > 0) {
    console.log("\n── 상세 목록 (처음 20개) ──");
    for (const item of allIssues.slice(0, 20)) {
      console.log(`  [${item.file}] ${item.slug}`);
      console.log(`    "${item.hero}"`);
      console.log(`    문제: ${item.issues.join(", ")}`);
    }
    if (allIssues.length > 20) {
      console.log(`\n  ... 외 ${allIssues.length - 20}개`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main();
