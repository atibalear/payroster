const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.end(d);});}).listen(8776);
(async()=>{const b=await chromium.launch();const p0=await b.newPage();await p0.goto('file://'+__dirname+'/payroster.html');await p0.waitForTimeout(500);const st=await p0.evaluate(()=>{save();return localStorage.getItem('payroster.v1')});
const c=await b.newContext({...devices['iPhone 13'],colorScheme:'dark'});await c.clock.install({time:new Date('2026-11-13T10:53:00Z')});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8776/index.html');await p.evaluate(s=>{const o=JSON.parse(s);o.lang='es';localStorage.setItem('payroster.v1',JSON.stringify(o))},st);await p.reload();await p.waitForTimeout(1500);
const sky=()=>p.evaluate(()=>document.querySelector('.td-sky')?.innerText.split('\n').slice(0,3).join(' | ')+' || '+(document.querySelector('.td-dly')?.innerText||'none'));
console.log(await sky());await p.evaluate(()=>document.querySelector('[data-tddly="30"]').click());await p.waitForTimeout(500);console.log(await sky());
await p.screenshot({path:'tour/gnd.png',fullPage:false});console.log(errs);await b.close();srv.close();})();
