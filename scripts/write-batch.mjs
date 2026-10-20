#!/usr/bin/env node
/** write-batch.mjs — 키워드 목록 자동 작성 (2026-10-20)
 *  사용: node scripts/write-batch.mjs 탈모/판시딜액3 탈모/아보다트 ...
 *        node scripts/write-batch.mjs --file 키워드목록.txt     (한 줄에 하나: "카테고리/슬러그" 또는 "카테고리/슬러그|검색 키워드")
 *        --dry  : 연관검색어 수집까지만 (작성 안 함)
 *  글마다: ① 네이버 연관검색어 수집 → ② claude -p "/write …" (근거 확인·작성·check-article·저장) → ③ 재검사·저장본=원고 대조
 *  배포는 하지 않는다. 끝나면 통과 목록과 부분배포 명령을 출력 → 운영자 승인 후 배포.
 *  보고서: _workspace/batch/{시각}.json
 *  전제: PC에 Claude Code 로그인, source-data/{슬러그}.json(식약처 원문), 네이버 접속 가능
 */
import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const fi = argv.indexOf("--file");
let items = fi > -1 ? fs.readFileSync(argv[fi + 1], "utf8").split(/\r?\n/) : argv.filter((a) => !a.startsWith("--"));
items = items.map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
if (!items.length) { console.error("사용: node scripts/write-batch.mjs 카테고리/슬러그 [...] | --file 목록.txt [--dry]"); process.exit(2); }

// /write 가 쓰는 도구만 미리 허용 (배포·푸시·삭제는 허용하지 않음)
const ALLOWED = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(node scripts/check-article.js:*)", "Bash(node scripts/save-article.js:*)",
  "Bash(node scripts/generate-article-json.mjs:*)", "Bash(node scripts/intent-harvest.mjs:*)", "Bash(git checkout public/sitemap.xml)", "Bash(ls:*)"];

const report = [];
for (const it of items) {
  const [key, kwRaw] = it.split("|").map((s) => s.trim());
  if (!key.includes("/")) { report.push({ key, result: "형식 오류(카테고리/슬러그)" }); continue; }
  const slug = key.split("/")[1];
  const kw = kwRaw || slug;
  const row = { key, keyword: kw };
  console.log(`\n━━ ${key} (검색 키워드: ${kw})`);
  // ① 연관검색어
  const h = spawnSync("node", ["scripts/intent-harvest.mjs", kw, "--slug", slug], { encoding: "utf8" });
  process.stdout.write(h.stdout || ""); process.stderr.write(h.stderr || "");
  if (h.status !== 0) { row.result = "중단: 연관검색어 수집 실패"; report.push(row); continue; }
  if (DRY) { row.result = "수집만(--dry)"; report.push(row); continue; }
  // ② 작성·검사·저장
  const prompt = `/write ${key} (일괄 모드: 7단계에서 배포 여부를 묻지 말고, 타이틀·소제목·검사 결과만 보고하고 끝낸다)`;
  const c = spawnSync("claude", ["-p", prompt, "--allowedTools", ...ALLOWED], { encoding: "utf8", timeout: 20 * 60 * 1000 });
  row.claude = (c.stdout || "").trim().split("\n").slice(-8).join("\n");
  if (c.error || c.status !== 0) { row.result = `중단: claude 실행 실패 (${c.error?.code || c.status})`; report.push(row); continue; }
  // ③ 재검사 + 저장본=원고
  const draft = path.join("_workspace", "drafts", slug + ".json");
  if (!fs.existsSync(draft)) { row.result = "중단: 원고 없음 (/write 가 근거 부족 등으로 멈춤 — claude 출력 확인)"; report.push(row); continue; }
  try { execSync(`node scripts/check-article.js "${key}" "${draft}"`, { stdio: "pipe" }); }
  catch (e) { row.result = "중단: 재검사 FAIL"; row.check = String(e.stdout || ""); report.push(row); continue; }
  try { execSync("node scripts/generate-article-json.mjs", { stdio: "pipe" }); execSync("git checkout public/sitemap.xml", { stdio: "pipe" }); } catch {}
  const d = JSON.parse(fs.readFileSync(draft, "utf8"));
  const pubPath = path.join("public", "data", key.split("/")[0], slug + ".json");
  const pub = fs.existsSync(pubPath) ? JSON.parse(fs.readFileSync(pubPath, "utf8")) : null;
  if (!pub || pub.title !== d.title || JSON.stringify(pub.sections) !== JSON.stringify(d.sections)) { row.result = "중단: 저장본이 원고와 다름"; report.push(row); continue; }
  row.result = "PASS"; row.title = d.title; report.push(row);
}

fs.mkdirSync(path.join("_workspace", "batch"), { recursive: true });
const out = path.join("_workspace", "batch", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json");
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log("\n━━ 결과");
for (const r of report) console.log(`${r.result === "PASS" ? "✅" : "⛔"} ${r.key} — ${r.result}${r.title ? " | " + r.title : ""}`);
const ok = report.filter((r) => r.result === "PASS").map((r) => r.key);
console.log(`\n보고서: ${out}`);
if (ok.length) console.log(`배포(승인 후): node scripts/deploy-incremental.mjs --slugs ${ok.join(",")}`);
