#!/usr/bin/env node
/** apply-article.js와 동일하지만 대상 파일을 명시적으로 지정 (동일 슬러그가 여러 카테고리 파일에 중복 존재할 때 사용).
 *  사용: node scripts/apply-article-tofile.js {slug} {draft.json} {targetFile.ts}
 */
const fs=require('fs');
const [slug,draftPath,targetFile]=process.argv.slice(2);
const d=JSON.parse(fs.readFileSync(draftPath,'utf8'));
const fpath='data/articles/'+targetFile;
const s=fs.readFileSync(fpath,'utf8');
let i=-1,indent='';
for(const pat of ['  "'+slug+'": {','    "'+slug+'": {','    '+slug+': {','  '+slug+': {']){
  const idx=s.indexOf(pat);
  if(idx>-1){i=idx;indent=pat.match(/^\s*/)[0];break;}
}
if(i<0){console.error('APPLY_FAIL '+slug+' 블록 없음 in '+targetFile);process.exit(1);}
const seg0=s.slice(i,i+1500);
const g=re=>{const m=seg0.match(re);return m?m[1]:''};
const dp=g(/"?datePublished"?:\s*"([^"]+)"/)||'2026-03-01';
const cat=g(/"?categorySlug"?:\s*"([^"]+)"/)||'';
const prm=seg0.match(/"?priceRange"?:\s*\{[^}]+\}/);
const today=new Date().toISOString().slice(0,10);
let braceStart=s.indexOf('{',i);
let depth=0,end=-1;
for(let p=braceStart;p<s.length;p++){const ch=s[p];
  if(ch==='"'){p++;while(p<s.length&&s[p]!=='"'){if(s[p]==='\\')p++;p++;}continue;}
  if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=p+1;break;}}
}
if(end===-1){console.error('APPLY_FAIL '+slug+' 블록 끝 탐지 실패');process.exit(1);}
if(s[end]===',')end++;
const pad=indent+'  ';const esc=t=>t.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n');
const secs=d.sections.map(x=>pad+'  {\n'+pad+'    title: "'+esc(x.title)+'",\n'+pad+'    content:\n'+pad+'      "'+esc(x.content)+'",\n'+pad+'  },').join('\n');
const faq=d.faq.map(x=>pad+'  {\n'+pad+'    question: "'+esc(x.question)+'",\n'+pad+'    answer:\n'+pad+'      "'+esc(x.answer)+'",\n'+pad+'  },').join('\n');
const block=indent+'"'+slug+'": {\n'
 +pad+'slug: "'+slug+'",\n'+pad+'categorySlug: "'+cat+'",\n'
 +pad+'datePublished: "'+dp+'",\n'+pad+'dateModified: "'+today+'",\n'
 +pad+'title: "'+esc(d.title)+'",\n'+pad+'h1: "'+esc(d.title)+'",\n'
 +pad+'metaDescription:\n'+pad+'  "'+esc(d.metaDescription)+'",\n'
 +pad+'description:\n'+pad+'  "'+esc(d.metaDescription.slice(0,85))+'",\n'
 +pad+'heroDescription:\n'+pad+'  "'+esc(d.heroDescription)+'",\n'
 +(prm?pad+prm[0].replace(/"priceRange"/,'priceRange')+',\n':'')
 +pad+'products: [],\n'
 +pad+'faq: [\n'+faq+'\n'+pad+'],\n'
 +pad+'sections: [\n'+secs+'\n'+pad+'],\n'
 +indent+'},';
fs.writeFileSync(fpath,s.slice(0,i)+block+'\n'+s.slice(end));
const hubFile='data/articles/'+cat+'.ts';
if(fs.existsSync(hubFile)){
  let h=fs.readFileSync(hubFile,'utf8');
  h=h.replace(new RegExp('("?slug"?: "'+slug+'",\\s*\\n\\s*"?title"?: )"[^"]*"'),'$1"'+esc(d.title)+'"');
  fs.writeFileSync(hubFile,h);
}
const ts=require(process.cwd()+'/node_modules/typescript/lib/typescript.js');
const sf=ts.createSourceFile('a',fs.readFileSync(fpath,'utf8'),ts.ScriptTarget.ES2020,true,ts.ScriptKind.TS);
if(sf.parseDiagnostics.length){console.error('APPLY_FAIL '+slug+' TS구문오류');process.exit(2);}
console.log('APPLIED '+slug+' → '+targetFile);
