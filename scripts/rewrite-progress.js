const fs=require("fs");
const dir="data/articles";
const ledger=fs.existsSync("_workspace/rewrite-ledger.json")?JSON.parse(fs.readFileSync("_workspace/rewrite-ledger.json","utf8")):{};
const cats={};
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith(".ts"))continue;
  const cat=f.replace(/-?\d*\.ts$/,"");
  const t=fs.readFileSync(dir+"/"+f,"utf8");
  const re=/slug:\s*"([^"]+)"/g;let m;
  while(m=re.exec(t)){
    const slug=m[1];const win=t.slice(m.index,m.index+2500);
    const tt=(win.match(/title:\s*"([^"]+)"/)||[])[1]||"";
    cats[cat]=cats[cat]||{total:0,legacy:0,done:0,slugs:[]};
    const C=cats[cat];C.total++;
    const isLedger=(ledger[cat]&&ledger[cat].done||[]).includes(slug);
    const isLegacy=/\|/.test(tt)||/최저가 가격 \||성분 효과 복용법/.test(tt);
    if(isLedger) C.done++;
    else if(isLegacy) C.legacy++;
  }
}
console.log("카테고리        총편수  완료(확정)  레거시(미완)  진행률");
for(const[c,v]of Object.entries(cats).sort((a,b)=>b[1].total-a[1].total)){
  const pct=((v.done/v.total)*100).toFixed(1);
  console.log(c.padEnd(14), String(v.total).padStart(5), String(v.done).padStart(9), String(v.legacy).padStart(11), "   "+pct+"%");
}
