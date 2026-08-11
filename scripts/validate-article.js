#!/usr/bin/env node
/** 3단계: 작성 결과 품질 게이트 — 통과 못 하면 반려
 *  사용: node scripts/validate-article.js {slug} {draft.json}
 *  draft.json: { title, metaDescription, heroDescription, sections:[{title,content}], faq:[{question,answer}] }
 */
const fs = require("fs");
const [slug, draftFile] = process.argv.slice(2);
const brief = JSON.parse(fs.readFileSync(`_workspace/briefs/${slug}.json`, "utf8"));
const d = JSON.parse(fs.readFileSync(draftFile, "utf8"));
const fails = [];
const body = [d.heroDescription, ...d.sections.map((s) => s.content), ...d.faq.map((f) => f.answer)].join(" ");
// T1 타이틀
// 2026-07-27: T1 오탐 수리 — slug는 붙여쓰기('그린나잘스프레이모이스쳐액'), 타이틀은 가독성상
//   띄어쓰기('그린 나잘 스프레이 모이스쳐액')가 자연스럽다. startsWith 원문 비교가 이를 위반으로 잡아
//   같은 글이 3회 연속 T1 반려로 전멸했다(2026-07-27 실측: 그린나잘스프레이모이스쳐액).
//   공백을 무시하고 비교하되, 실패 시 무엇이 문제인지 타이틀 원문을 함께 보여준다.
const _sq = (x) => String(x || "").replace(/\s+/g, "");
if (!_sq(d.title).startsWith(_sq(slug)))
  fails.push(`T1: 제품명이 선두 아님 — 타이틀 "${String(d.title).slice(0, 30)}"은(는) "${slug}"(으)로 시작해야 함(띄어쓰기는 허용)`);
if (!/가격/.test(d.title)) fails.push("T2: 타이틀에 '가격' 단어 필수 (검색어 일치 — 최저가만으로는 불충분)");
if (/\d{1,3}(,\d{3})*\s*원(?!큐)/.test(d.title)) fails.push("T3: 타이틀에 가격 숫자");
if ((d.title.match(/[|ㅣ]/g) || []).length > 1) fails.push("T4: 파이프 2회+");
if (d.title.length < 20 || d.title.length > 45) fails.push("T5: 길이 " + d.title.length);
// T6 타이틀 약속 ↔ H2
const promises = ["효능", "효과", "부작용", "복용법", "사용법", "보관"].filter((k) => d.title.includes(k));
for (const k of promises) if (!d.sections.some((s) => s.title.includes(k) || (k === "효능" && s.title.includes("효과")) || (k === "효과" && s.title.includes("효능")))) fails.push("T6: 타이틀 약속 '" + k + "' H2 없음");
if (!d.sections.some((s) => /가격/.test(s.title))) fails.push("T6: 가격 H2 없음");
// T6b 가격 H2 중앙 배치 — 맨 앞/맨 끝 금지, 복용법·사용법 뒤에 와야 함
{const idxPrice=d.sections.findIndex((s)=>/가격|최저가|얼마(?!나)/.test(s.title));
 const idxUse=d.sections.findIndex((s)=>/복용법|사용법|먹는|바르는/.test(s.title));
 if(idxPrice===0) fails.push("T6b: 가격 H2가 맨 앞 — 본문 중앙(복용법 뒤)로");
 if(idxPrice===d.sections.length-1) fails.push("T6b: 가격 H2가 맨 끝 — 본문 중앙(복용법 뒤)로");
 if(idxUse>-1 && idxPrice>-1 && idxPrice<idxUse) fails.push("T6b: 가격 H2가 복용법보다 앞 — 복용법 바로 뒤로 이동");}
// T8 H2 제품명 포함 (6개 중 최소 4개)
const slugCore=slug.replace(/[\d.]+\s*(mg|밀리그램|%|밀리)?$/,"").replace(/[\d.]+$/,"");
// 2026-07-27: T8도 T1과 같은 띄어쓰기 오탐 — H2가 "그린 나잘 스프레이 모이스쳐액 사용법"처럼
//   읽기 좋게 띄어쓰면 includes(slug)가 전부 실패해 "H2 0개만 제품명 포함"으로 잡혔다.
const named=d.sections.filter((s)=>{const t=_sq(s.title);return t.includes(_sq(slug))||(slugCore.length>=2&&t.includes(_sq(slugCore)));}).length;
// 2026-08-03: 하한 4 → 3. 근거 — 기준본(탈모/미녹시딜) H2 중 제품명 포함이 3개라 기준본이 스스로 걸렸다. 원칙 0-4.
if(named<3) fails.push("T8: H2 "+named+"개만 제품명 포함 (최소 3개 — SEO 주제 신호)");
// T9 타이틀 약속 ↔ 본문 이행 (못 지킬 약속 = 클릭베이트 차단)
// 9a) 입증 불가 가격 인과 주장: 식약처·가격 데이터로 'A가 왜 비싼지'는 입증 불가 → 타이틀 금지
if(/비싼\s*이유|싼\s*이유|저렴한\s*이유|선택\s*이유|왜\s*(비싸|싼|비쌀|저렴|비쌈)|비쌀까|쌀까|싸ㄹ까/.test(d.title))
  fails.push("T9a: 타이틀이 입증 불가한 가격 인과('비싼 이유/왜 비싸/선택 이유')를 약속 — 본문이 원가 이유를 댈 수 없음. 검증 가능한 각도(가격 위치·순위·비교·최저가)로 교체");
// 9c) 경험담 위장 금지: 우리 글은 식약처 정보지 후기가 아님 — "복용 후 효과/먹어보니/써보니/후기/체험" 같은 1인칭 경험 암시 차단
if(/복용\s*후|복용후|먹어\s*보|써\s*보|발라\s*보|복용\s*해\s*보|후기|체험|직접\s*(먹|복용|써|발라)|개월\s*복용\s*(후|효과)|복용\s*(\d+\s*개월|후기)/.test(d.title))
  fails.push("T9c: 타이틀이 실제 복용 경험('복용 후/먹어보니/후기/N개월 복용')을 암시 — 사기성. 정보형('효과 언제부터·3개월 기준·복용 시')으로 교체");
// 9b) 타이틀의 질문/약속 키워드가 본문에 실제로 답이 있어야 함
{const bodyAll=body;
 const promiseChecks=[
   {re:/언제부터|며칠|얼마나 (걸|지나)/,need:/개월|주|일|단위|기간|꾸준/,label:"효과 시점(언제부터)"},
   {re:/얼마\??$|얼마인가|1정당 얼마|한 ?병 얼마|값/,need:/원/,label:"가격(얼마)"},
   {re:/어디쯤|순위|몇 ?위|중 (가장|어디)/,need:/위\b|순위|개 (제품|중)|범위|최저|최고/,label:"가격 위치/순위"},
   {re:/중단하면|끊으면|중단 ?후/,need:/중단|끊|재발|돌아|원래대로|되돌/,label:"중단 시 결과"},
   {re:/차이$|차이를|차이는|vs|대비/,need:/차이|다르|반면|비해|보다/,label:"차이/비교"},
   {re:/가장 (높|비싸|저렴|낮)|제일 (높|비싸|저렴|낮)/,need:/위\b|순위|중|범위|가장|상위|하위/,label:"가격 극단(가장 높/저렴)"},
   {re:/처방/,need:/처방|병원|의사|진료|전문의약품|비대면/,label:"처방(처방 절차·경로)"},
   {re:/비대면/,need:/비대면|온라인 ?진료|앱|화상|원격/,label:"비대면 처방"},
   {re:/직구/,need:/직구|해외|국내|통관|배송|정식 ?수입/,label:"직구 vs 국내"},
   {re:/한 ?달|월 ?비용|한달/,need:/원/,label:"한 달 비용(금액)"},
   {re:/약국마다|약국 ?가격|약국별|성지/,need:/약국|편차|천차만별|비급여|약국마다/,label:"약국 가격 편차"},
   {re:/3% ?5%|농도|\d% ?(랑|와|과|vs)/,need:/3%|5%|농도|함량/,label:"농도별(3%/5%)"},
   {re:/정품|카피약|제네릭 ?대비|오리지널/,need:/정품|카피|제네릭|오리지널|동등|복제/,label:"정품·카피약 비교"},
 ];
 for(const c of promiseChecks){ if(c.re.test(d.title) && !c.need.test(bodyAll)) fails.push("T9b: 타이틀이 '"+c.label+"'을 약속했는데 본문에 그 답이 없음 — 약속 이행 또는 타이틀 변경"); }
}
// B1 숫자 화이트리스트
const wl = new Set(brief.numericWhitelist.map((n) => n.replace(/[^\d.]/g, "")));
(brief.verifiedExternalFacts||[]).forEach(f=>(f.nums||[]).forEach(n=>wl.add(String(n))));
const nums = body.match(/\d+(?:[.,]\d+)?/g) || [];
const derived = new Set(); // 단순 산수 허용: 가격/수량, ×30, ×12, 만원 환산
if (brief.product && brief.product.price) { const p = brief.product.price; const c = +((brief.product.unit || "").match(/(\d+)/) || [0, 0])[1]; if (c) { const per = Math.round(p / c); derived.add(String(per)); derived.add(String(Math.round((p / c) * 30))); derived.add(String(per * 30)); derived.add(String(Math.round((p / c) * 365))); derived.add(String(per * 365)); } }
if (brief.pricePosition) { brief.pricePosition.cheapest3.concat(brief.pricePosition.original || []).forEach((x) => { derived.add(String(x.per)); derived.add(String(x.per * 30)); derived.add(String(x.per * 365)); derived.add(String(x.price)); }); derived.add(String(brief.pricePosition.groupSize)); derived.add(String(brief.pricePosition.rank)); brief.pricePosition.range.forEach((r) => { derived.add(String(r)); derived.add(String(r * 30)); derived.add(String(r * 365)); }); }
[1, 2, 3, 100].forEach((n) => derived.add(String(n)));
const isYear = (n) => /^(19|20)\d{2}$/.test(n) && +n >= 1990 && +n <= 2030; // 허가·등록 연도는 정당
const bad = [...new Set(nums.map((n) => n.replace(/,/g, "")))].filter((n) => !wl.has(n) && !derived.has(n) && !derived.has(String(Math.round(+n / 10) * 10)) && !isYear(n) && +n > 3);
if (bad.length) fails.push("B1: 출처 없는 숫자 → " + bad.slice(0, 10).join(", "));
// B2 금지문장(보일러플레이트)
const slugless = body.replaceAll(slug, "P");
let hit = 0; for (const s of brief.forbiddenSentences) if (slugless.includes(s)) hit++;
if (hit) fails.push("B2: 보일러플레이트 " + hit + "문장");
// B3 문체
if (/[가-힣]+(합니다|입니다|습니다)[.\s]/.test(body)) fails.push("B3: ~합니다체 발견(본문)");
// B4 가격 단어 밀도
if (!/가격|최저가/.test(body)) fails.push("B4: 가격/최저가 언급 없음 (가격 섹션 필수)");
// B5 출처 인용 밀도
const cite = (body.match(/식약처|허가사항|품목|식품안전나라|신고번호/g) || []).length;
if (cite < Math.floor(body.length / 1000)) fails.push("B5: 출처 인용 부족 (" + cite + "/" + Math.floor(body.length / 1000) + ")");
// B5b 외부 임상사실 출처 표기
if((brief.verifiedExternalFacts||[]).length && /DHT|환원효소|메타분석|FDA/.test(body) && !/임상|문헌|학회|FDA|연구/.test(body)) fails.push("B5b: 외부 임상사실에 출처 표기 없음");
// B6 글자수
// 2026-08-03: 상한 4200 → 7000. 근거 — 기준본(탈모/미녹시딜) 본문이 5089자라 상한 4200에 스스로 걸렸다.
//   §14 기준본 대조 게이트가 본문 하한을 4212자(공백제거)로 강제하는 이상, 상한 4200(공백포함)은 수학적으로 통과 불가.
//   원칙 0-4 "게이트는 자기 표준을 통과시켜야 유효" 위반이라 상한만 올린다. 하한 1800은 유지.
if (body.length < 1800 || body.length > 7000) fails.push("B6: 글자수 " + body.length);
// B7 교정 의무
if (brief.bodyRules.교정 && !/전립선|전립샘/.test(body)) fails.push("B7: 전립선 적응증 교정 미반영");
// 분할복용은 '권장'일 때만 금지. 경고문(안 돼요/금지/범위 밖/위험 등 근처)은 허용
{const splitMatches=[...body.matchAll(/.{0,70}(4등분|쪼개)(.{0,70})/g)];
 for(const m of splitMatches){const ctx=m[0];
   // 부정·안전·경고·표준복용법 문맥이면 허용 (오프라벨 관행을 '경고'로 서술한 경우 포함)
   if(/않|안 ?돼|안 ?되|아니|아닙|금지|말아|말고|밖이|밖예|밖에서|밖이라|위험|주의|권장(하지|되지)? ?않|하면 안|해선 안|허가 ?범위|허가 ?용법이 아|안전하지|통째|삼켜|삼키|있지만|알려진|정보가 도|돌아|관행/.test(ctx)) continue;
   fails.push("B7: 허가범위 밖 분할복용 '권장' 금지 (경고로 바꾸거나 삭제) → ..."+ctx.slice(0,55)+"...");break;}}
// T7/B9 사이트 전체 대조 (타이틀·서론 오차 방지)
try{
  const all=[];
  for(const f of fs.readdirSync("data/articles").filter(x=>x.endsWith(".ts"))){
    const src=fs.readFileSync("data/articles/"+f,"utf8");
    for(const m of src.matchAll(/slug:\s*"([^"]+)",\s*\n\s*categorySlug:[\s\S]{0,600}?title:\s*"([^"]+)"[\s\S]{0,2500}?heroDescription:\s*\n?\s*"([^"]+)"/g)){
      if(m[1]!==slug) all.push({slug:m[1],title:m[2],hero:m[3]});
    }
  }
  if(all.some(a=>a.title===d.title)) fails.push("T7: 동일 타이틀이 사이트에 이미 존재");
  const myPat=d.title.replace(new RegExp(slug,"g"),"{P}");
  const patCnt=all.filter(a=>a.title.replace(new RegExp(a.slug.replace(/[.*+?^$()|[\]\\]/g,"\\$&"),"g"),"{P}")===myPat).length;
  if(patCnt>=3) fails.push("T7: 같은 타이틀 패턴이 이미 "+patCnt+"개 (어순 변형 필요)");
  const myOpen=(d.heroDescription||"").slice(0,14);
  if(myOpen && all.filter(a=>(a.hero||"").slice(0,14)===myOpen).length>0) fails.push("B9: 서론 첫 문장 시작이 기존 글과 동일");
}catch(e){}
// B10 섹션 깊이 (소제목 100% 전달)
// 가격 H2는 현실적 하한 220자 — OTC 외용제는 가격 데이터가 단일가(예: 40g 6500원)뿐이라 300자는 패딩(=doorway) 유발. 콘텐츠 섹션은 300자 유지. (2026-06-20 연고 배치, 단일가 제품 수학적 충돌 해소)
for(const sec of d.sections){ const floor=/가격/.test(sec.title)?220:300; if((sec.content||"").length<floor) fails.push("B10: 섹션 '"+sec.title.slice(0,20)+"' "+(sec.content||"").length+"자 (최소 "+floor+"자, 소스 재료 소진 필요)"); }
// B11 문장 리듬 단조 (같은 종결어미 5연속)
const endings=(body.match(/(해요|예요|이에요|거든요|어요|아요|죠|돼요|네요)(?=[.!?])/g)||[]);
let run=1,mono=false; for(let i=1;i<endings.length;i++){ if(endings[i]===endings[i-1]){run++; if(run>=5){mono=true;break;}} else run=1; }
if(mono) fails.push("B11: 같은 종결어미 5연속 (문장 리듬 단조 — 짧은 문장·어미 변주 필요)");
// B14 인용 과잉 — "허가사항" 반복 상한 (300자당 1회 초과 금지)
const citeCnt=(body.match(/허가사항/g)||[]).length;
if(citeCnt>Math.ceil(body.length/300)) fails.push("B14: '허가사항' "+citeCnt+"회 — 과잉 반복 (상한 "+Math.ceil(body.length/300)+"회). 표현 변주(허가 기준·식약처 등록 정보·허가 문서) 또는 삭제");
// B15 문단 분리 — 400자+ 섹션이 한 덩어리면 반려 (벽글 방지)
for(const sec of d.sections){ const c=sec.content||""; if(c.length>420 && !c.includes("\n\n")) fails.push("B15: 섹션 '"+sec.title.slice(0,16)+"' "+c.length+"자 한 덩어리 — 2~3문단으로 분리"); }
// B16 섹션 시작 다양화 — 같은 구절로 시작하는 섹션 2개+ 금지 (식약처 허가사항은... 찍어내기 방지)
const opens=d.sections.map(s=>(s.content||"").slice(0,7));
const openCnt={}; opens.forEach(o=>openCnt[o]=(openCnt[o]||0)+1);
for(const [o,c] of Object.entries(openCnt)){ if(c>=2) fails.push("B16: 섹션 "+c+"개가 같은 구절('"+o+"...')로 시작 — 첫 문장 변주 필요"); }
const sikStart=opens.filter(o=>o.startsWith("식약처")).length;
if(sikStart>=2) fails.push("B16: '식약처'로 시작하는 섹션 "+sikStart+"개 — 답부터 쓰고 출처는 문장 뒤로");
// B8 찍어내기 서론 금지
const introBan=["핵심부터 말하면","결론부터 말하면","정리했어요.","정리했습니다."];
const secBan=["답부터 말하면","기준은 명확해요","숫자로 보면 이래요","기준선부터 보죠","숫자가 말해줘요","답은 간단해요","기준은 하나예요"];
for(const sec of d.sections){for(const ph of secBan){if((sec.content||"").includes(ph))fails.push("B8b: 기계 문구 '"+ph+"' (섹션: "+sec.title.slice(0,12)+") — 자연스러운 답 문장으로");}}
for(const ph of introBan){ if((d.heroDescription||"").includes(ph)) fails.push("B8: 서론 금지문구 '"+ph+"' (찍어내기 패턴)"); }
// ── 2026-07-02 운영자 육안 지적 → 규칙화 (기준 상향만 가능 원칙) ──
// B17 문단 분할 의무 — 섹션당 문단(\n\n) 2개 미만 = 벽글 반려 (라이브 실측: 가독성 붕괴)
for(const sec of d.sections){ const paras=(sec.content||"").split("\n\n").filter(x=>x.trim()).length; if(paras<2) fails.push("B17: 섹션 '"+sec.title.slice(0,16)+"' 문단 "+paras+"개 — 벽글 금지, 3~4줄마다 빈 줄로 분할(숫자·임상은 별도 문단)"); }
// B18 상투 공감 서론 금지 — "~시기가 있죠/고민이시죠/걱정이시죠/떠오르는 게" 류 AI 공감 오프닝
const heroFirst=(d.heroDescription||"").split(/[.?!]/)[0];
const heroBan=[/시기가 있[죠다]/, /고민이시죠/, /걱정이시죠/, /걱정 많으시죠/, /떠오르는 게/, /눈에 밟히/, /한숨이 나오/, /머리카락을 세어/];
for(const re of heroBan){ if(re.test(heroFirst)) fails.push("B18: 서론 첫 문장 상투 공감 패턴('"+heroFirst.slice(0,25)+"...') — 제품 정의나 검색 질문 즉답으로 시작"); }
// B19 출처 전용 섹션 금지 — AuthorBio가 E-E-A-T 처리, 본문 중복 금지 (2026-07-02 운영자 지적)
for(const sec of d.sections){ if(/어디서 확인|정보의 출처|출처는 어디/.test(sec.title)) fails.push("B19: 출처 전용 섹션('"+sec.title.slice(0,20)+"') 금지 — 에디터 박스와 중복. 출처는 본문 문장에 녹일 것"); }
// T8b 제품명 과다 (2026-07-02 운영자 지적): H2 전부가 제품명으로 시작하면 기계 냄새 — 1개 이상은 제품명 없이
{ const h2p = d.sections.filter((x)=>x.title.includes(d.title.split(" ")[0].replace(/[,?!ㅣ|].*$/,""))).length;
  if (d.sections.length >= 5 && h2p >= d.sections.length) fails.push("T8b: H2 " + h2p + "/" + d.sections.length + " 전부 제품명 포함 — 1~2개는 제품명 없이 (예: '먹으면 안 되는 사람은요?')"); }
// B8c 군더더기 맺음말 금지 — 문단/섹션 끝에 갖다붙이는 짧은 단정문 (사람이 안 쓰는 AI 맺음말)
const fillerBan=["그러면 돼요","그게 답이에요","단순하죠","단순해요","비교는 금방이에요","확인이 먼저예요","확인이 우선이에요","어렵지 않아요","복잡하지 않아요","그뿐이에요","그게 전부예요","부담은 줄여야죠","손해를 줄여요","알고 고르면 돼요","비교는 필수예요","확인은 필수예요","기준은 분명해요","답은 명확해요","계산은 간단해요","그게 핵심이에요","간단하죠"];
const fillerHit=new Set();
for(const sec of d.sections){for(const ph of fillerBan){if((sec.content||"").includes(ph))fillerHit.add(ph);}}
if((d.heroDescription||"")){for(const ph of fillerBan){if(d.heroDescription.includes(ph))fillerHit.add(ph);}}
if(fillerHit.size)fails.push("B8c: 군더더기 맺음말 "+fillerHit.size+"종 ("+[...fillerHit].slice(0,5).join("/")+") — 문단 끝 기계 맺음말 삭제, 정보로 끝맺을 것");
// B12 주제 집중도 — 카테고리 핵심어가 본문을 지배해야 함 (유방>탈모 사고 방지)
const CAT_KW={탈모:/탈모|모발|발모|머리카락/g,감기:/감기|콧물|기침|발열|몸살/g,진통제:/통증|진통|두통|해열/g,연고:/상처|연고|피부|환부/g,무좀:/무좀|백선|진균|곰팡이/g,소화제:/소화|체|위장|더부룩/g,유산균:/유산균|장|배변|프로바이오틱스/g};
const catRe=CAT_KW[brief.cat];
// 전립선약 여부: 브리프 교정 플래그 또는 source 적응증이 전립선 (5mg 피나/두타)
const isProstateDrug = !!(brief.bodyRules && brief.bodyRules.교정) || /전립선|전립샘/.test(JSON.stringify(brief.source||{}).slice(0,2000));
if(catRe){
  const catCnt=(body.match(catRe)||[]).length;
  // 피나스테리드 5mg만 '탈모는 1mg로' 안내 필요. 두타스테리드 0.5mg·피나 1mg은 탈모 정식 허가라 불필요
  const pdesc=(brief.product&&brief.product.desc||"")+" "+slug;
  const isFina5 = /피나스테리드/.test(pdesc) && /(?<![.\d])5\s*mg|(?<![.\d])5밀리/.test(pdesc);
  if(isProstateDrug){
    if(catCnt<6) fails.push("B12p: 전립선약이라도 탈모 검색자용이니 탈모/모발 맥락 6회+ 필요 (현재 "+catCnt+")");
    if(isFina5 && (!/1\s*mg/.test(body) || !/처방|허가 제품|허가받|탈모.*1mg|1mg.*탈모/.test(body))) fails.push("B12p: 피나스테리드 5mg은 '탈모 목적이면 1mg 허가 제품 처방' 정직 안내 필수");
  } else {
    const need=Math.max(6,Math.ceil(body.length/400));
    if(catCnt<need) fails.push("B12: 카테고리 핵심어("+brief.cat+") "+catCnt+"회 < 최소 "+need+"회 — 주제 이탈");
    for(const w of ["유방","고환","발기","사정","전립선","임신"]){
      const c=(body.match(new RegExp(w,"g"))||[]).length;
      if(c>0 && c>=catCnt) fails.push("B12: '"+w+"' "+c+"회 ≥ 핵심어 "+catCnt+"회 — 앵커가 주제를 잡아먹음 (앵커는 1개 섹션 이내로)");
    }
  }
}
// B13 띄어쓰기 품질 — 공백 비율 + 무공백 한글 연쇄
const hangul=(body.match(/[가-힣]/g)||[]).length;
const spaces=(body.match(/ /g)||[]).length;
if(hangul>500 && spaces/hangul<0.16) fails.push("B13: 띄어쓰기 불량 (공백비율 "+(spaces/hangul).toFixed(2)+" < 0.16)");
const longRuns=(body.match(/[가-힣]{18,}/g)||[]);
if(longRuns.length>0) fails.push("B13: 무공백 한글 연쇄 "+longRuns.length+"건 (예: '"+longRuns[0].slice(0,18)+"...')");
console.log(fails.length ? "FAIL\n- " + fails.join("\n- ") : "PASS ✓ (타이틀·숫자·문체·중복·인용 전 항목 통과)");
process.exit(fails.length ? 1 : 0);
