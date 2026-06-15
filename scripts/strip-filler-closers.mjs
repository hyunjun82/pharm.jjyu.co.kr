/**
 * strip-filler-closers.mjs — AI 군더더기 맺음말 제거 (결정적·환각 0)
 * data/articles/탈모-N.ts 안 섹션/FAQ/서론 문자열에서, 문단 끝에 갖다붙은
 * 짧은 단정 맺음말 문장만 정확히 삭제한다. 정보 문장은 건드리지 않는다.
 *
 * 사용: node scripts/strip-filler-closers.mjs [--write] [파일...]
 *   --write 없으면 미리보기(건수만), 있으면 실제 수정.
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";

const FILLERS = [
  "그러면 돼요", "그게 답이에요", "단순하죠", "단순해요", "비교는 금방이에요",
  "확인이 먼저예요", "확인이 우선이에요", "어렵지 않아요", "복잡하지 않아요",
  "그뿐이에요", "그게 전부예요", "부담은 줄여야죠", "손해를 줄여요",
  "알고 고르면 돼요", "비교는 필수예요", "확인은 필수예요", "기준은 분명해요",
  "답은 명확해요", "계산은 간단해요", "그게 핵심이에요", "간단하죠",
  "확인은 금방이에요", "비교가 먼저예요", "선택은 본인 몫이에요",
];

// 짧은 수식 어구를 앞에 단 변형도 포함: "정말 단순해요", "사실 어렵지 않아요" 등
const PREFIX = "(?:정말 |사실 |생각보다 |의외로 |그래서 |결국 )?";
// 맺음말이 한 문장으로 끝에 붙은 경우만: 앞에 마침표/줄바꿈, 뒤에 마침표+(끝/공백/줄바꿈)
const patterns = FILLERS.map(
  (f) => new RegExp("([.!?\\n]\\s*)" + PREFIX + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[.!]", "g")
);

const args = process.argv.slice(2);
const write = args.includes("--write");
let files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  files = readdirSync("data/articles").filter((f) => /^탈모(-\d+)?\.ts$/.test(f)).map((f) => "data/articles/" + f);
}

let totalRemoved = 0;
const touched = [];
for (const file of files) {
  let src = readFileSync(file, "utf8");
  let removed = 0;
  for (const re of patterns) {
    src = src.replace(re, (m, lead) => { removed++; return lead.trimEnd(); });
  }
  if (removed) {
    totalRemoved += removed;
    touched.push(file + " (" + removed + ")");
    if (write) writeFileSync(file, src);
  }
}
console.log((write ? "✂️ 삭제 완료" : "👀 미리보기") + " — 군더더기 맺음말 " + totalRemoved + "건");
touched.forEach((t) => console.log("  " + t));
if (!write) console.log("\n실제 적용: node scripts/strip-filler-closers.mjs --write");
