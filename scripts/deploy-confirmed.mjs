#!/usr/bin/env node
/**
 * deploy-confirmed.mjs — 원장(rewrite-ledger.json)의 "확정 완료" 글만 한 번에 배포한다.
 * 사용: node scripts/deploy-confirmed.mjs [카테고리]   (기본 카테고리: 탈모)
 *
 * 슬러그를 일일이 안 쳐도 됨. 확정분 전체를 deploy-incremental.mjs로 넘긴다.
 * deploy-incremental이 사이트맵 전체재생성 + 푸시 게이트(미달 차단)를 자동 수행.
 */
import { execSync } from "child_process";
import fs from "fs";

const CAT = process.argv[2] || "탈모";
const L = JSON.parse(fs.readFileSync("_workspace/rewrite-ledger.json", "utf8"));
const done = (L[CAT] && L[CAT].done) || [];
if (!done.length) { console.error(`확정 글 없음 (${CAT})`); process.exit(1); }

const slugs = done.map((s) => `${CAT}/${s}`).join(",");
console.log(`확정 ${done.length}편 배포 시작 (${CAT})\n  ${done.join(", ")}\n`);
execSync(`node scripts/deploy-incremental.mjs --slugs ${slugs}`, { stdio: "inherit" });
