const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d);});}).listen(8777);
(async()=>{const b=await chromium.launch();const errs=[];
const c0=await b.newContext();const p=await c0.newPage();await p.goto('file://'+__dirname+'/payroster.html');await p.waitForTimeout(500);
const base=await p.evaluate(()=>{const {stale,...k}=state;return JSON.stringify(k)});
let n=0;
for(const [lang,scheme,dev] of [['es','light','iPhone 13'],['es','dark','iPhone 13'],['hu','light','iPhone SE']]){
const c=await b.newContext({...devices[dev],deviceScaleFactor:2,colorScheme:scheme});const p2=await c.newPage();p2.on('pageerror',e=>errs.push(e.message));
await p2.goto('http://localhost:8777/index.html');await p2.evaluate(([s,l])=>{const o=JSON.parse(s);o.lang=l;localStorage.setItem('payroster.v1',JSON.stringify(o))},[base,lang]);await p2.reload();await p2.waitForTimeout(1500);
await p2.evaluate(()=>{scrollTo(0,0);setTab('roster')});await p2.waitForTimeout(300);
await p2.screenshot({path:`tour/tb${n++}.png`});console.log(await p2.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]));await c.close();}
console.log(errs);await b.close();srv.close();})();
