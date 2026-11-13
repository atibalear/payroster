const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d);});}).listen(8775);
(async()=>{const b=await chromium.launch();const errs=[];
const c0=await b.newContext();const p=await c0.newPage();await p.goto('file://'+__dirname+'/payroster.html');await p.waitForTimeout(500);
const st=await p.evaluate(()=>{const {stale,...k}=state;k.lang='es';return JSON.stringify(k)});
const times=process.argv.slice(2);let i=0;
for(const tm of times){const c=await b.newContext({...devices['iPhone 13'],deviceScaleFactor:2,timezoneId:'Europe/Berlin'});await c.clock.install({time:new Date(tm)});
 const p2=await c.newPage();p2.on('pageerror',e=>errs.push(e.message));
 await p2.goto('http://localhost:8775/index.html');await p2.evaluate(s=>localStorage.setItem('payroster.v1',s),st);await p2.reload();await p2.waitForTimeout(1500);
 await p2.evaluate(()=>{const e=document.getElementById('stale');if(e)e.remove();document.querySelectorAll('.licalert').forEach(x=>x.hidden=true)});
 const el=await p2.$('#today');await p2.evaluate(()=>scrollTo(0,0));await p2.screenshot({path:`tour/sky${i++}.png`,fullPage:false});await (await p2.$('.td-next')).screenshot({path:'tour/stubs.png'});await c.close();}
console.log(errs);await b.close();srv.close();})();
