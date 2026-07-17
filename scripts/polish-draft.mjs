// 결정적 폴리시 — 반복 기계 결함 자동 교정 (환각 0). 사용: node scripts/polish-draft.mjs <draft.json>
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2];
const d = JSON.parse(readFileSync(file, "utf8"));
const FILLER = ["그러면 돼요","그게 답이에요","단순하죠","단순해요","비교는 금방이에요","확인이 먼저예요","확인이 우선이에요","어렵지 않아요","복잡하지 않아요","그뿐이에요","그게 전부예요","부담은 줄여야죠","손해를 줄여요","알고 고르면 돼요","비교는 필수예요","확인은 필수예요","기준은 분명해요","답은 명확해요","계산은 간단해요","그게 핵심이에요","간단하죠"];
const fillerRe = FILLER.map(f=>new RegExp("([.!?\\n]\\s*)(?:정말 |사실 |생각보다 |그래서 |결국 )?"+f.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"[.!]","g"));
const introBanRe = /\s*(?:이렇게\s*)?(?:한눈에\s*)?정리했어요[.!]/g;
// 허가사항 변주: 4번째 이후 등장을 동의어로 순환 치환
// 받침 있는 단어만(이/은/을/가 조사 호환) — '허가 문서이' 같은 조사 오류 방지
const SYN = ["허가 기준","허가 용법","허가 규정","허가 내역"];
let gAllow=0; // 전역 카운터 — 글 전체에서 '허가사항'은 4회까지만, 이후 동의어 (필드별 리셋 버그 방지)
function variAllow(text){
  return text.replace(/허가사항/g, (m)=>{ gAllow++; return gAllow<=4 ? m : SYN[gAllow%SYN.length]; });
}
const shortFillerRe = FILLER.map(f=>new RegExp("(^|[.!?\\n]\\s*)[^.!?\\n]{0,24}"+f.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"[.!]","g"));
function polish(t){
  if(!t) return t;
  for(const re of fillerRe) t=t.replace(re,(m,lead)=>lead.trimEnd());
  for(const re of shortFillerRe) t=t.replace(re,(m,lead)=>lead.trimEnd());
  t=t.replace(introBanRe,"");
  t=variAllow(t);
  return t.replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").trim();
}
// 어미 자동 재균형 — 손으로 하던 교정을 코드로 (어미 5연속·쏠림 자동 해소)
// 문법 안전한 치환만: 이에요→이죠, 해요→하죠, 돼요→되죠, 거예요→거죠
// 각 어미를 여러 대체형으로 분산(한 대체형 쏠림 방지). [정규식, [대체1, 대체2...]]
const SWAP={
  "이에요":[/이에요([.!])$/, ["이죠$1","이고요$1"]],
  "예요":[/([가-힣])예요([.!])$/, ["$1죠$2","$1고요$2"]],
  "해요":[/([가-힣])해요([.!])$/, ["$1하죠$2","$1하거든요$2"]],
  "돼요":[/돼요([.!])$/, ["되죠$1","되거든요$1"]],
  "어요":[/([가-힣])었어요([.!])$/, ["$1었죠$2","$1었거든요$2"]],
  "네요":[/([가-힣])네요([.!])$/, ["$1군요$2","$1더라고요$2"]],
};
// 'X어요/X아요' 일반형은 어간이 섞여 위험 → 안전한 정확 단어만 치환
const WORD_SWAP=[
  [/있어요([.!])$/, ["있죠$1","있고요$1"]], [/없어요([.!])$/, ["없죠$1","없고요$1"]],
  [/같아요([.!])$/, ["같죠$1","같고요$1"]], [/받아요([.!])$/, ["받죠$1"]],
  [/줄어요([.!])$/, ["줄죠$1"]], [/늘어요([.!])$/, ["늘죠$1"]], [/남아요([.!])$/, ["남죠$1"]],
  [/많아요([.!])$/, ["많죠$1","많고요$1"]], [/높아요([.!])$/, ["높죠$1"]], [/좋아요([.!])$/, ["좋죠$1","좋고요$1"]],
  // 부작용 섹션 임상 인용 빈출 어미
  [/보고됐어요([.!])$/, ["보고됐죠$1","보고됐고요$1"]], [/였어요([.!])$/, ["였죠$1","였고요$1"]],
  [/이었어요([.!])$/, ["이었죠$1","이었고요$1"]], [/없어졌어요([.!])$/, ["없어졌죠$1"]],
  [/나타났어요([.!])$/, ["나타났죠$1","나타났고요$1"]], [/생겼어요([.!])$/, ["생겼죠$1"]],
  [/늘었어요([.!])$/, ["늘었죠$1"]], [/줄었어요([.!])$/, ["줄었죠$1"]], [/됐어요([.!])$/, ["됐죠$1","됐고요$1"]],
  [/있었어요([.!])$/, ["있었죠$1"]], [/같았어요([.!])$/, ["같았죠$1"]], [/돌아와요([.!])$/, ["돌아오죠$1"]],
];
const wrot={};
const rot={}; // 어미별 대체형 회전 인덱스
function endOf(s){const m=s.match(/(이에요|이죠|이고요|해요|하죠|하거든요|예요|고요|거든요|었어요|었죠|어요|아요|죠|돼요|되죠|네요|군요|더라고요)[.!?]?$/);return m?m[1]:"_";}
function rebalanceEndings(fields){
  // 문장+뒤따르는 공백(\n\n 포함)을 토큰으로 보존
  const tokens=[];const map=[];
  fields.forEach((t,fi)=>{const re=/[^.!?]*[.!?]+[ \t]*\n*|\S[^.!?]*$/g;let m;while((m=re.exec(t))!==null){if(m[0]==="")break;tokens.push(m[0]);map.push(fi);}});
  const core=s=>s.replace(/\s+$/,"");           // 끝 공백 제거한 문장
  const tail=s=>s.slice(core(s).length);         // 보존할 뒤 공백
  const counts={};tokens.forEach(s=>{const e=endOf(core(s));counts[e]=(counts[e]||0)+1;});
  const total=tokens.length||1;let run=1;
  for(let i=1;i<tokens.length;i++){
    const e=endOf(core(tokens[i])),pe=endOf(core(tokens[i-1]));
    run=(e===pe&&e!=="_")?run+1:1;
    const dominant=(counts[e]/total)>0.26;
    if((run>=2||dominant)&&SWAP[e]){
      const [reg,reps]=SWAP[e]; rot[e]=(rot[e]||0); const rep=reps[rot[e]%reps.length];
      let c=core(tokens[i]).replace(reg,rep);
      if(c!==core(tokens[i])){rot[e]++;counts[e]--;counts[endOf(c)]=(counts[endOf(c)]||0)+1;tokens[i]=c+tail(tokens[i]);run=1;}
    } else if((run>=2||dominant)&&(e==="어요"||e==="아요")){
      // 일반 어요/아요 쏠림: 안전 단어 치환 시도
      let c0=core(tokens[i]);
      for(let wi=0;wi<WORD_SWAP.length;wi++){const [reg,reps]=WORD_SWAP[wi];if(reg.test(c0)){wrot[wi]=(wrot[wi]||0);const c=c0.replace(reg,reps[wrot[wi]%reps.length]);if(c!==c0){wrot[wi]++;counts[e]--;counts[endOf(c)]=(counts[endOf(c)]||0)+1;tokens[i]=c+tail(tokens[i]);run=1;break;}}}
    }
  }
  const out=fields.map(()=>"");
  tokens.forEach((s,i)=>{out[map[i]]+=s;});
  return out.map(t=>t.trim());
}
// 검증기 B11과 동일 버킷으로 5연속 강제 해소 (이죠/하죠 등은 검증기 눈엔 '죠')
const vBucket=(s)=>{const m=s.replace(/\s+$/,"").match(/(해요|예요|이에요|거든요|어요|아요|죠|돼요|네요)[.!?]?$/);return m?m[1]:"_";};
const ALL_SWAP=[...Object.values(SWAP), ...WORD_SWAP];
function breakRuns(fields){
  const tokens=[];const map=[];
  fields.forEach((t,fi)=>{const re=/[^.!?]*[.!?]+[ \t]*\n*|\S[^.!?]*$/g;let m;while((m=re.exec(t))!==null){if(m[0]==="")break;tokens.push(m[0]);map.push(fi);}});
  const core=s=>s.replace(/\s+$/,""), tail=s=>s.slice(core(s).length);
  let run=1;
  for(let i=1;i<tokens.length;i++){
    if(vBucket(tokens[i])===vBucket(tokens[i-1])&&vBucket(tokens[i])!=="_") run++; else run=1;
    if(run>=4){ // 4연속째에서 끊기 (5 도달 전)
      let c=core(tokens[i]);
      for(const [reg,reps] of ALL_SWAP){ if(reg.test(c)){ for(const rep of reps){ const c2=c.replace(reg,rep); if(vBucket(c2)!==vBucket(tokens[i-1])){ c=c2; break; } } if(c!==core(tokens[i])) break; } }
      if(c!==core(tokens[i])){ tokens[i]=c+tail(tokens[i]); run=1; }
    }
  }
  const out=fields.map(()=>""); tokens.forEach((s,i)=>{out[map[i]]+=s;}); return out.map(t=>t.trim());
}
// 섹션 자동 정렬 — 표준 순서(효과→어떤약→복용법→가격→부작용→금기). FAQ/기타는 끝.
{const ord=(t)=>{ // 우선순위 고정: 가격·부작용·금기를 먼저 판정해 키워드 교차매칭 방지
   if(/가격|최저가|비용|값|얼마(?!나)/.test(t))return 3;
   if(/부작용|이상반응/.test(t))return 4;
   if(/금기|안 되는|쓰면 안|먹으면 안|주의사항|못 (쓰|먹)|끊으면|중단하면/.test(t))return 5;
   if(/복용법|사용법|먹는 법|바르는 법|어떻게 (복용|사용|먹|발라|쓰)/.test(t))return 2;
   if(/효과|언제부터|어떤 탈모|기전|얼마나 (걸|지나)/.test(t))return 0;
   if(/어떤 약|무슨 약|성분/.test(t))return 1;
   return 8;};
 d.sections=d.sections.map((s,i)=>({s,i})).sort((a,b)=>{const d2=ord(a.s.title)-ord(b.s.title);return d2!==0?d2:a.i-b.i;}).map(x=>x.s);}
// 섹션 시작 자동 변주 — '식약처' 시작 2개+ 또는 같은 7자 시작 2개+ 를 해소 (B16 자동)
{const LEADS=["짚고 갈 부분이 있어요. ","이 대목이 중요해요. ","하나씩 살펴볼게요. ","먼저 이걸 봐야 해요. ","여기서부터 정리해요. ","놓치기 쉬운 지점이에요. ","바로 확인해 볼게요. ","핵심을 먼저 볼게요. "];
 const seen={}; let sikSeen=0;
 d.sections=d.sections.map((s,si)=>{
   let c=(s.content||"");
   // 멱등성: 이미 LEAD로 시작하면 그 LEAD를 떼고 원문 기준으로 판정 (중복 적용 방지)
   for(const L of LEADS){ if(c.startsWith(L)){ c=c.slice(L.length); break; } }
   const head=c.slice(0,7);
   const isSik=/^식약처/.test(c);
   const dup=seen[head];
   if((isSik&&sikSeen>=1) || dup){ c=LEADS[si%LEADS.length]+c; } // 섹션 인덱스로 고유 배정(충돌 방지)
   if(isSik) sikSeen++;
   seen[head]=(seen[head]||0)+1;
   return {...s,content:c};
 });}
let fields=[d.heroDescription, ...d.sections.map(s=>s.content), ...d.faq.map(f=>f.answer)].map(polish);
fields=rebalanceEndings(fields);
fields=breakRuns(fields);
d.heroDescription=fields[0];
d.sections=d.sections.map((s,i)=>({...s,content:fields[1+i]}));
d.faq=d.faq.map((f,i)=>({...f,answer:fields[1+d.sections.length+i]}));
writeFileSync(file, JSON.stringify(d, null, 1));
console.log("polished " + file.split("/").pop());
