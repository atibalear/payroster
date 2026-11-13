const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(d);});}).listen(8778);
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 13'],deviceScaleFactor:2});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8778/index.html');await p.waitForTimeout(800);
await (await p.$('#pdfIn')).setInputFiles('/mnt/user-data/attachments/8eff94cd-c5b1-5aef-8f96-f7ba1433ad51/7981721a-DUTY-PLAN-2026-01-01-2026-11-30.pdf');await p.waitForTimeout(6000);
await p.tap('#mLabel');await p.waitForTimeout(300);await p.screenshot({path:'tour/mp.png'});
await p.tap('[data-mpick="2026-07"]');await p.waitForTimeout(500);console.log(await p.evaluate(()=>[state.current,document.getElementById('mLabel').textContent,document.getElementById('mPick').hidden]));
console.log(errs);await b.close();srv.close();})();
