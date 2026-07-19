/**
 * ping-indexnow.mjs — 배포된 URL을 IndexNow로 통지 (빙+네이버+얀덱스 공유)
 * 사용: node scripts/ping-indexnow.mjs 탈모/아보다트,감기/판콜에스내복액
 *       node scripts/ping-indexnow.mjs --all-recent        # 최근 7일 lastmod 글 전체 (sitemap 기준)
 *       node scripts/ping-indexnow.mjs --all-recent 30     # 최근 30일
 *       node scripts/ping-indexnow.mjs --all-recent 30 --dry  # 전송 없이 목록만 확인
 *
 * 2026-07-19: --all-recent가 주석에만 있고 미구현이던 버그 수리 —
 *   "--all-recent" 문자열을 슬러그로 오인해 쓰레기 URL 1건만 전송하고 있었음 (실측).
 *   public/sitemap.xml의 lastmod를 파싱해 기간 내 URL 전체를 전송하도록 구현.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HOST = "pharm.jjyu.co.kr";
const KEY = "9c135131626d49088fa4bfff9b5e8672";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const arg = args[0] || "";
if (!arg) { console.log("사용: node scripts/ping-indexnow.mjs {cat}/{slug},...  또는  --all-recent [일수] [--dry]"); process.exit(1); }

let urls = [];
if (arg === "--all-recent") {
  const days = Number(args[1]) > 0 ? Number(args[1]) : 7;
  const cutoff = Date.now() - days * 86400 * 1000;
  const xml = readFileSync(join(ROOT, "public", "sitemap.xml"), "utf8");
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
  urls = entries
    .filter((m) => {
      const t = Date.parse(m[2]);
      return Number.isFinite(t) && t >= cutoff;
    })
    .map((m) => m[1].trim());
  console.log(`sitemap ${entries.length}개 URL 중 최근 ${days}일 lastmod ${urls.length}건 선별`);
  if (!urls.length) { console.log("보낼 URL이 없어요."); process.exit(0); }
} else {
  urls = arg.split(",").filter(Boolean).map((p) => {
    const [cat, slug] = p.trim().split("/");
    return `https://${HOST}/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}/`;
  });
}

if (dry) {
  console.log(urls.slice(0, 20).join("\n") + (urls.length > 20 ? `\n... 외 ${urls.length - 20}건` : ""));
  console.log(`[dry] 전송 생략 — 총 ${urls.length}건`);
  process.exit(0);
}

// IndexNow는 요청당 최대 10,000건. 안전하게 5,000건씩 분할 전송.
const CHUNK = 5000;
for (let i = 0; i < urls.length; i += CHUNK) {
  const chunk = urls.slice(i, i + CHUNK);
  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: chunk });
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body,
  });
  console.log(`IndexNow 통지: ${chunk.length}건 → HTTP ${res.status} ${res.status === 200 || res.status === 202 ? "✅" : "⚠️"}`);
}
