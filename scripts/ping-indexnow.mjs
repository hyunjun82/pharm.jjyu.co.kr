/**
 * ping-indexnow.mjs — 배포된 URL을 IndexNow로 통지 (빙+네이버+얀덱스 공유)
 * 사용: node scripts/ping-indexnow.mjs 탈모/아보다트,감기/판콜에스내복액
 *       node scripts/ping-indexnow.mjs --all-recent   # 최근 7일 dateModified 글 전체
 */
const HOST = "pharm.jjyu.co.kr";
const KEY = "9c135131626d49088fa4bfff9b5e8672";
const arg = process.argv[2] || "";
if (!arg) { console.log("사용: node scripts/ping-indexnow.mjs {cat}/{slug},..."); process.exit(1); }

const urls = arg.split(",").filter(Boolean).map((p) => {
  const [cat, slug] = p.trim().split("/");
  return `https://${HOST}/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}/`;
});

const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls });
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body,
});
console.log(`IndexNow 통지: ${urls.length}건 → HTTP ${res.status} ${res.status === 200 || res.status === 202 ? "✅" : "⚠️"}`);
