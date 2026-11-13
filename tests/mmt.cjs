const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.end(d);});}).listen(8774);
(async()=>{const b=await chromium.launch();const p0=await b.newPage();await p0.goto('file://'+__dirname+'/payroster.html');await p0.waitForTimeout(500);const st=await p0.evaluate(()=>{save();return localStorage.getItem('payroster.v1')});
const c=await b.newContext({...devices['iPhone 13']});await c.clock.install({time:new Date(process.argv[2])});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8774/index.html');await p.evaluate(s=>{const o=JSON.parse(s);o.lang='es';localStorage.setItem('payroster.v1',JSON.stringify(o))},st);await p.reload();await p.waitForTimeout(1500);
console.log('btn',!!(await p.$('#td-mm')));await p.click('#td-mm');await p.waitForTimeout(1500);
const txt=async()=>(await p.evaluate(()=>document.getElementById('toolPanel').innerText)).split('\n').filter(x=>/tierra|Retraso|despeg|Sale|min|%/.test(x)).slice(0,6).join(' | ');
console.log(await txt());await p.evaluate(()=>document.querySelector('[data-mmdly="60"]').click());await p.waitForTimeout(800);console.log(await txt());
console.log(errs);await b.close();srv.close();})();
