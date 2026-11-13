const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.end(d);});}).listen(8770);
(async()=>{const b=await chromium.launch();const scheme=process.argv[2]||'light';const c=await b.newContext({...devices['iPhone 13'],deviceScaleFactor:1,colorScheme:scheme});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+__dirname+'/payroster.html');await p.waitForTimeout(500);
const st=await p.evaluate(()=>{save();return localStorage.getItem('payroster.v1')});
const p2=await c.newPage();p2.on('pageerror',e=>errs.push(e.message));
await p2.goto('http://localhost:8770/index.html');await p2.evaluate(s=>{const o=JSON.parse(s);o.lang='es';localStorage.setItem('payroster.v1',JSON.stringify(o))},st);await p2.reload();await p2.waitForTimeout(1200);

const shot=async n=>{await p2.waitForTimeout(300);await p2.evaluate(()=>scrollTo(0,0));await p2.screenshot({path:'tour/'+scheme[0]+'_'+n+'.png',fullPage:true});};
await p2.evaluate(()=>setTab('roster'));await shot('01_roster');
await p2.evaluate(()=>setTab('tools'));await shot('02_tools');
await p2.evaluate(()=>{state.fam={role:'adopt',birth:'2026-12-15',child:'2025-09-03',weeks:6,blocks:[]};});
for(const t of ['earn','lay','map','check','sim','cal','ftl','fat','vac','lic','sales','year','wrap','cmp','fam','backup']){await p2.evaluate(t=>{setTab('tools');openTool(t)},t);await shot('t_'+t);}
await p2.evaluate(()=>setTab('more'));await shot('03_more');
console.log(errs);await b.close();srv.close();})();
