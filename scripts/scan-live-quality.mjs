import { readdirSync, readFileSync, writeFileSync } from "fs";

const dir = "public/data/탈모";
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

// 군더더기 맺음말 — 기계가 문단 끝에 갖다붙이는 짧은 단정문 (사장님 지적 변종)
const FILLER = [
  "그러면 돼요", "그게 답이에요", "단순하죠", "단순해요", "기준은 분명해요", "기준은 명확해요",
  "비교는 금방이에요", "확인이 먼저예요", "확인이 우선이에요", "답부터 말하면", "핵심부터 말하면",
  "결론부터 말하면", "숫자로 보면 이래요", "기준선부터 보죠", "답은 간단해요", "기준은 하나예요",
  "어렵지 않아요", "복잡하지 않아요", "그뿐이에요", "그게 전부예요", "부담은 줄여야죠",
  "손해를 줄여요", "알고 고르면 돼요", "비교는 필수예요", "확인은 필수예요",
];
const SENS = ["유방", "고환", "발기", "사정", "전립선", "임신"];

const report = { total: files.length, defects: [] };
for (const f of files) {
  const slug = f.replace(".json", "");
  let d;
  try { d = JSON.parse(readFileSync(dir + "/" + f, "utf8")); }
  catch (e) { report.defects.push({ slug, issues: ["JSON파싱실패:" + e.message.slice(0, 30)] }); continue; }
  const secs = d.sections || [];
  const body = [d.heroDescription || "", ...secs.map((s) => s.content || ""), ...(d.faq || []).map((x) => x.answer || "")].join(" ");
  const issues = [];

  // 1) 군더더기 맺음말 (핵심 지적)
  const fill = FILLER.filter((p) => body.includes(p));
  if (fill.length) issues.push("군더더기[" + fill.length + "]:" + fill.slice(0, 4).join("/"));

  // 2) 주제 이탈
  const cat = (body.match(/탈모|모발|발모|머리카락/g) || []).length;
  for (const w of SENS) { const c = (body.match(new RegExp(w, "g")) || []).length; if (c > 0 && c >= cat) { issues.push(w + "(" + c + ")≥탈모(" + cat + ")"); break; } }

  // 3) 허가사항 과잉
  const heo = (body.match(/허가사항/g) || []).length; const cap = Math.ceil(body.length / 300);
  if (heo > cap) issues.push("허가사항" + heo + ">" + cap);

  // 4) 띄어쓰기
  const runs = (body.match(/[가-힣]{18,}/g) || []).length; if (runs) issues.push("무공백" + runs);

  // 5) 섹션 짧음
  const short = secs.filter((s) => (s.content || "").length < 300).length; if (short) issues.push("짧은섹션" + short);

  // 6) ~합니다체
  if (/[가-힣]+(합니다|입니다|습니다)[.\s]/.test(body)) issues.push("합니다체");

  // 7) 글자수
  if (body.length < 1800) issues.push("짧음" + body.length);

  if (issues.length) report.defects.push({ slug, issues });
}
report.defects.sort((a, b) => b.issues.length - a.issues.length);

const tally = {};
report.defects.forEach((d) => d.issues.forEach((i) => { const k = i.split(/[\[:0-9(]/)[0]; tally[k] = (tally[k] || 0) + 1; }));

console.log(`총 ${report.total}편 / 결함 ${report.defects.length}편 (${(100 * report.defects.length / report.total).toFixed(0)}%)`);
console.log("--- 결함 유형 집계 ---");
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + k + " : " + v + "편"));
console.log("--- 상위 30편 ---");
report.defects.slice(0, 30).forEach((d) => console.log("  " + d.slug + " → " + d.issues.join(", ")));
writeFileSync("_workspace/탈모-live-defects.json", JSON.stringify(report, null, 1));
console.log("\n→ 전체 목록: _workspace/탈모-live-defects.json");
