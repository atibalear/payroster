const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.end(d);});}).listen(8772);
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone SE']});const p=await c.newPage();
await p.goto('file://'+__dirname+'/payroster.html');await p.waitForTimeout(500);
const st=await p.evaluate(()=>{save();return localStorage.getItem('payroster.v1')});
const p2=await c.newPage();await p2.goto('http://localhost:8772/index.html');
await p2.evaluate(s=>{const o=JSON.parse(s);o.lang='hu';localStorage.setItem('payroster.v1',JSON.stringify(o));localStorage.setItem('pr.ui','{"zoom":100}')},st);
await p2.reload();await p2.waitForTimeout(1000);
await p2.evaluate(()=>setTab('roster'));await p2.waitForTimeout(200);console.log(await p2.evaluate(()=>{const W=document.documentElement.clientWidth;return [...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1&&r.width>0}).slice(0,8).map(e=>e.tagName+'.'+e.className+'#'+e.id+' '+Math.round(e.getBoundingClientRect().right)+' '+e.textContent.slice(0,50))}));
for(const tab of ['roster','tools','more']){await p2.evaluate(t=>setTab(t),tab);await p2.waitForTimeout(200);console.log(tab,await p2.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]));}
for(const t of ['check','year','fam','ftl','map','lay','sim','cal']){await p2.evaluate(t=>{openTool(t)},t);await p2.waitForTimeout(300);console.log(t,await p2.evaluate(()=>document.documentElement.scrollWidth));}
await b.close();srv.close();})();
